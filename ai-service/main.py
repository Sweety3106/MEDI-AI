import os
import json
import re
import httpx
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import spacy
from deep_translator import GoogleTranslator
from dotenv import load_dotenv
from fpdf import FPDF
import base64
from io import BytesIO

load_dotenv()

# =========================
# CONFIG
# =========================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="MediAI AI Service")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("BACKEND_URL", "http://localhost:5000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load spaCy model for fallback
try:
    nlp = spacy.load("en_core_web_sm")
except:
    # If not found, we'll handle it in the fallback function
    nlp = None

# =========================
# REQUEST MODEL
# =========================

class ExtractRequest(BaseModel):
    text: str
    language: str  # "en" or "hi"

class DiagnosisRequest(BaseModel):
    extractedSymptoms: List[dict]
    riskScore: Optional[float] = 0
    patientAge: Optional[int] = None
    patientGender: Optional[str] = None
    chronicConditions: Optional[List[str]] = []

class SoapNoteRequest(BaseModel):
    patientProfile: dict  # {age, gender, chronicConditions, medications}
    rawInput: str
    extractedSymptoms: List[dict]
    diagnosisPredictions: dict  # {differentialDiagnosis, mostLikelyDiagnosis, urgency}
    riskScore: float

class DrugInteractionRequest(BaseModel):
    medications: List[str]

# =========================
# HELPER FUNCTIONS
# =========================

def translate_to_english(text: str, language: str) -> str:
    if language == "hi":
        return GoogleTranslator(source="hi", target="en").translate(text)
    return text


def call_gpt_extraction(text: str):
    system_prompt = """
You are a medical NLP system. Extract structured clinical entities 
from patient symptom descriptions.

Return ONLY valid JSON with this exact schema:

{
  "extractedSymptoms": [
    {
      "name": string,
      "bodyLocation": string | null,
      "severity": number | null,
      "duration": string | null,
      "onset": string | null,
      "character": string | null,
      "associatedFactors": string[],
      "negated": boolean
    }
  ],
  "vitalMentions": {
    "temperature": string | null,
    "bp": string | null,
    "hr": string | null
  },
  "patientAge": number | null,
  "patientGender": string | null,
  "extractionConfidence": number
}

If severity is textual (mild/moderate/severe), convert to 1–10 scale.
Only output JSON.
"""

    response = client.chat.completions.create(
        model=os.getenv("MODEL_NAME", "gpt-4o"),
        temperature=0,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
    )

    content = response.choices[0].message.content.strip()
    
    # Clean GPT response if it includes markdown blocks
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()

    try:
        return json.loads(content)
    except:
        raise ValueError("GPT output not valid JSON")


# =========================
# FALLBACK ENGINE
# =========================

SYMPTOM_KEYWORDS = [
    "pain", "fever", "vomiting", "cough", "headache",
    "breath", "dizziness", "fatigue"
]

SEVERITY_MAP = {
    "mild": 3,
    "moderate": 5,
    "severe": 8
}

def fallback_extraction(text: str):
    extracted = []
    text_lower = text.lower()
    
    # Common negation markers (English and Hindi)
    negation_markers = [r"\bno\b", r"\bnot\b", r"\bdenies\b", r"\bnegative\b", r"\bnahi\b", r"\bni\b", r"\bna\b"]
    
    if nlp:
        doc = nlp(text)
        for token in doc:
            if token.lemma_ in SYMPTOM_KEYWORDS:
                severity = None
                for word, score in SEVERITY_MAP.items():
                    if word in text_lower:
                        severity = score

                # Improved duration regex to catch "2 days", "since 2 hours", "for two weeks" etc.
                duration_pattern = r"\b((?:since|for|last)?\s?(?:\d+|one|two|three|four|five|several)\s?(?:hours?|days?|weeks?|months?|hrs?|mins?))\b"
                duration_match = re.search(duration_pattern, text_lower)
                duration = duration_match.group(1) if duration_match else None

                # Check for negation in context (3 tokens before or 3 tokens after)
                is_negated = False
                # Check preceding tokens
                for j in range(max(0, token.i - 3), token.i):
                    if any(re.search(m, doc[j].text.lower()) for m in negation_markers):
                        is_negated = True
                        break
                # Check following tokens (especially for Hindi: "bukhar nahi hai")
                if not is_negated:
                    for j in range(token.i + 1, min(len(doc), token.i + 4)):
                        if any(re.search(m, doc[j].text.lower()) for m in negation_markers):
                            is_negated = True
                            break

                extracted.append({
                    "name": token.text,
                    "bodyLocation": None,
                    "severity": severity,
                    "duration": duration,
                    "onset": None,
                    "character": None,
                    "associatedFactors": [],
                    "negated": is_negated
                })
    else:
        # Simple regex keyword matching if spaCy is missing
        for keyword in SYMPTOM_KEYWORDS:
            if keyword in text_lower:
                # Basic negation check for keyword
                is_negated = False
                # Check for negation markers near the keyword (before or after)
                keyword_pos = text_lower.find(keyword)
                start = max(0, keyword_pos-25)
                end = min(len(text_lower), keyword_pos + len(keyword) + 25)
                context = text_lower[start:end]
                
                if any(re.search(m, context) for m in negation_markers):
                    is_negated = True

                extracted.append({
                    "name": keyword,
                    "bodyLocation": None,
                    "severity": None,
                    "duration": None,
                    "onset": None,
                    "character": None,
                    "associatedFactors": [],
                    "negated": is_negated
                })

    # Extract vitals
    temp = re.search(r"(\d+\.?\d*\s?°?C)", text)
    bp = re.search(r"(\d+/\d+)", text)
    hr = re.search(r"(\d+\s?bpm)", text)

    return {
        "extractedSymptoms": extracted,
        "vitalMentions": {
            "temperature": temp.group(1) if temp else None,
            "bp": bp.group(1) if bp else None,
            "hr": hr.group(1) if hr else None
        },
        "patientAge": None,
        "patientGender": None,
        "extractionConfidence": 0.5
    }

def fallback_diagnosis(req: DiagnosisRequest):
    return {
        "differentialDiagnosis": [
            {
                "condition": "Clinical Review Required",
                "icdCode": "Z00.00",
                "confidenceScore": 0.0,
                "supportingSymptoms": [s.get("name") for s in req.extractedSymptoms if s.get("name")],
                "againstSymptoms": [],
                "reasoning": "AI diagnostic engine is currently offline. Please consult a physician.",
                "recommendedTests": ["Physical Exam"]
            }
        ],
        "mostLikelyDiagnosis": "Inconclusive",
        "urgency": "medium",
        "disclaimer": "FALLBACK MODE: AI analysis failed. Please consult a doctor."
    }

def fallback_soap_note(req: SoapNoteRequest):
    subj = f"Patient reports symptoms: {req.rawInput}."
    obj = f"Clinical indicators: {', '.join([s.get('name') for s in req.extractedSymptoms if s.get('name')])}."
    return {
        "formattedText": f"SUBJECTIVE: {subj}\n\nOBJECTIVE: {obj}\n\nASSESSMENT: AI analysis currently unavailable.\n\nPLAN: Clinical review required.",
        "structuredData": {
            "subjective": subj,
            "objective": obj,
            "assessment": "AI analysis unavailable.",
            "plan": "Consult physician."
        }
    }

def fallback_drug_interactions(medications: list):
    return {
        "interactions": [
            {
                "drug1": medications[i],
                "drug2": medications[j],
                "severity": "none",
                "description": "Interaction check unavailable.",
                "clinicalSignificance": "Unknown",
                "recommendation": "Check with pharmacist.",
                "sources": []
            } for i in range(len(medications)) for j in range(i+1, len(medications))
        ],
        "summary": "Check unavailable (Fallback Mode)",
        "overallSafetyRating": "caution",
        "medications": medications
    }

# =========================
# MAIN ENDPOINTS
# =========================

@app.get("/health")
async def health_check():
    return {
        "status": "UP",
        "service": "MediAI AI Service",
        "version": "1.0.0"
    }

@app.post("/extract-symptoms")
def extract_symptoms(req: ExtractRequest):
    if req.language not in ["en", "hi"]:
        raise HTTPException(status_code=400, detail="Language must be 'en' or 'hi'")

    translated_text = translate_to_english(req.text, req.language)

    # Try GPT first
    try:
        result = call_gpt_extraction(translated_text)
        return result
    except Exception as e:
        print(f"GPT Extraction failed: {e}")
        # Fallback engine
        return fallback_extraction(translated_text)

@app.post("/generate-diagnosis")
def generate_diagnosis(req: DiagnosisRequest):
    system_prompt = """
You are an experienced internal medicine physician AI assistant. 
Given structured symptom data, generate a differential diagnosis list.
You are NOT replacing a doctor — your output assists clinical decision-making.
Always recommend professional medical consultation.

Return ONLY valid JSON with this exact schema:

{
  "differentialDiagnosis": [
    {
      "condition": string,
      "icdCode": string,
      "confidenceScore": number,
      "supportingSymptoms": string[],
      "againstSymptoms": string[],
      "reasoning": string,
      "recommendedTests": string[]
    }
  ],
  "mostLikelyDiagnosis": string,
  "urgency": "low" | "medium" | "high" | "immediate",
  "disclaimer": string
}

Include ICD-10 codes for clinical credibility. Show top 3-5 conditions.
Only output JSON.
"""

    user_content = f"""
Symptom Data: {json.dumps(req.extractedSymptoms)}
Risk Score: {req.riskScore}
Patient Profile: {req.patientAge}yo {req.patientGender}, History: {req.chronicConditions}
"""

    try:
        response = client.chat.completions.create(
            model=os.getenv("MODEL_NAME", "gpt-4o"),
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        )

        content = response.choices[0].message.content.strip()
        
        # Clean GPT response
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        return json.loads(content)
    except Exception as e:
        print(f"Diagnosis generation failed: {e}")
        return fallback_diagnosis(req)

def generate_pdf_base64(soap_text: str, patient_name: str = "Patient") -> str:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(190, 10, "MediAI Clinical SOAP Note", ln=True, align="C")
    pdf.set_font("Arial", "", 12)
    pdf.ln(5)
    pdf.multi_cell(0, 10, soap_text)
    
    # Use BytesIO to avoid writing to disk
    pdf_buffer = BytesIO()
    pdf_output = pdf.output()
    pdf_buffer.write(pdf_output)
    pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode("utf-8")
    return pdf_base64

@app.post("/generate-soap-note")
def generate_soap_note(req: SoapNoteRequest):
    system_prompt = """
You are a medical scribe. Generate a professional SOAP clinical note based on provided patient data.
The note must be structured into Subjective, Objective, Assessment, and Plan.
Include a disclaimer at the end.

Return ONLY valid JSON with this schema:
{
  "formattedText": string,
  "structuredData": {
    "subjective": string,
    "objective": string,
    "assessment": string,
    "plan": string
  }
}
"""

    user_content = f"""
Patient: {req.patientProfile}
Chief Complaint (Raw): {req.rawInput}
Symptoms: {json.dumps(req.extractedSymptoms)}
Diagnoses: {json.dumps(req.diagnosisPredictions)}
Risk: {req.riskScore}
"""

    try:
        response = client.chat.completions.create(
            model=os.getenv("MODEL_NAME", "gpt-4o"),
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        )

        content = response.choices[0].message.content.strip()
        
        # Clean GPT response
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        result = json.loads(content)
        
        # Add PDF export link (base64)
        result["pdfExport"] = generate_pdf_base64(result["formattedText"])
        return result
    except Exception as e:
        print(f"SOAP note generation failed: {e}")
        result = fallback_soap_note(req)
        result["pdfExport"] = generate_pdf_base64(result["formattedText"])
        return result

@app.post("/check-drug-interactions")
async def check_drug_interactions(req: DrugInteractionRequest):
    if len(req.medications) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 medications to check interactions.")

    medications = [m.strip() for m in req.medications]

    # 1. Query OpenFDA for each drug pair
    fda_interactions = []
    async with httpx.AsyncClient(timeout=10.0) as http:
        for i, drug1 in enumerate(medications):
            for drug2 in medications[i+1:]:
                try:
                    url = f"https://api.fda.gov/drug/label.json?search=drug_interactions:{drug1}+AND+drug_interactions:{drug2}&limit=1"
                    response = await http.get(url)
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("results"):
                            fda_interactions.append({
                                "drug1": drug1,
                                "drug2": drug2,
                                "fda_text": data["results"][0].get("drug_interactions", ["No interaction data"])[0][:500]
                            })
                except Exception as e:
                    print(f"FDA lookup failed for {drug1}/{drug2}: {e}")

    # 2. Use GPT-4o to structure and explain interactions
    system_prompt = """
You are a clinical pharmacologist AI. Analyze drug interactions between provided medications.
For each pair, determine severity and clinical significance.

Return ONLY valid JSON:
{
  "interactions": [
    {
      "drug1": string,
      "drug2": string,
      "severity": "severe" | "moderate" | "minor" | "none",
      "description": string,
      "clinicalSignificance": string,
      "recommendation": string,
      "sources": string[]
    }
  ],
  "summary": string,
  "overallSafetyRating": "safe" | "caution" | "danger"
}
Only output JSON. Include ALL pairs even if no interaction.
"""

    user_content = f"""
Medications: {', '.join(medications)}

FDA Reference Data: {json.dumps(fda_interactions)}

Analyze all pairwise interactions for these {len(medications)} medications.
"""

    try:
        response = client.chat.completions.create(
            model=os.getenv("MODEL_NAME", "gpt-4o"),
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()

        result = json.loads(content)
        result["medications"] = medications
        return result
    except Exception as e:
        print(f"Drug interaction check failed: {e}")
        return fallback_drug_interactions(medications)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
