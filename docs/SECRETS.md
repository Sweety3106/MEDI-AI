# MediAI Secrets Management

## Environment Variables

### Backend (`/backend/.env`)
| Variable | Description | Required |
| --- | --- | --- |
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Backend server port (default 5000) | Yes |
| `MONGODB_URI` | MongoDB Connection String (Atlas/Local) | Yes |
| `JWT_SECRET` | Secret for Access Token | Yes |
| `JWT_REFRESH_SECRET` | Secret for Refresh Token | Yes |
| `AI_SERVICE_URL` | URL of the Python AI Service | Yes |
| `CORS_ORIGIN` | Authorized Frontend URL | Yes |

### AI Service (`/ai-service/.env`)
| Variable | Description | Required |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI API Key | Yes |
| `MODEL_NAME` | AI Model (e.g., gpt-4o) | Yes |
| `DRUGBANK_API_KEY` | DrugBank API Key | Optional |
| `PORT` | AI Service port (default 8000) | Yes |

### Frontend (`/frontend/.env`)
| Variable | Description | Required |
| --- | --- | --- |
| `VITE_API_URL` | Backend API Base URL | Yes |
| `VITE_APP_NAME` | Application Name | Yes |
| `VITE_ENVIRONMENT` | App environment | Yes |

## Best Practices
1. **Never commit `.env` files** to Git.
2. Use `.env.example` to document keys.
3. Use a secrets vault (e.g., AWS Secrets Manager, Doppler) for production.
4. Rotate sensitive keys (JWT secrets, API keys) every 90 days.
