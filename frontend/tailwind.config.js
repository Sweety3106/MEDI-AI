/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "med-teal": "hsl(var(--med-teal))",
                "med-bg": "hsl(var(--med-bg))",
                "med-text": "hsl(var(--med-text))",
                "med-border": "hsl(var(--med-border))",
                "med-card": "hsl(var(--med-card))",
                risk: {
                    critical: "#EF4444",
                    high: "#F97316",
                    medium: "#EAB308",
                    low: "#22C55E",
                }
            },
            fontFamily: {
                sans: ["Inter", "sans-serif"],
            },
        },
    },
    plugins: [],
}
