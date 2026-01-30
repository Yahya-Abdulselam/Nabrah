# Nabrah (نبرة) - Emergency Voice Triage System

**5-Second Emergency Voice Triage with Bilingual Support (English/Arabic)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-green)](https://www.python.org/)

Nabrah is a lightweight, bilingual web application that analyzes 5-second voice recordings to detect speech abnormalities and provide RED/YELLOW/GREEN triage recommendations for emergency situations. Supports both English and Arabic (Modern Standard Arabic) with full RTL layout support.

---

## 🎯 Features

### Core Functionality
- **5-Second Voice Recording**: Quick and easy voice capture using Web Audio API
- **Real-time Waveform Visualization**: Visual feedback during recording
- **Advanced Acoustic Analysis**: Speech pattern detection using Praat/Parselmouth
- **Intelligent Triage System**: Rule-based scoring with language-specific thresholds
- **Multi-Method Validation**: Praat acoustic analysis + Whisper transcription + WER calculation
- **Quality Metrics**: SNR (Signal-to-Noise Ratio) and VAD (Voice Activity Detection)
- **Clinical Queue System**: SQLite-based patient queue with priority sorting

### Language Support 🌍
- **Bilingual Interface**: Full support for English and Arabic (MSA)
- **RTL Layout**: Right-to-left text direction for Arabic
- **Language-Specific Thresholds**: Adjusted acoustic thresholds for Arabic speech patterns
- **Arabic Speech Recognition**: Whisper integration with Arabic model support
- **Bilingual Reports**: Technical terms shown as "Jitter (الارتعاش)" in Arabic mode
- **Layman Explanations**: Non-technical explanations for clinicians without speech analysis experience

### Design & Performance
- **Mobile-First**: Responsive design optimized for all devices (min width: 320px)
- **Lightweight**: < 150KB gzipped JavaScript bundle
- **Fast**: Browser-based WAV encoding eliminates FFmpeg dependency
- **Accessible**: WCAG 2.1 compliant with full keyboard navigation

---

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 16.1.4 (App Router)
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (button, card, progress, badge)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Audio Processing**: Web Audio API (native browser)
- **WAV Encoding**: Custom browser-based encoder with resampling (no FFmpeg needed!)
- **i18n**: Custom React Context-based implementation
- **Fonts**: Geist Sans/Mono (English), Noto Sans Arabic (Arabic)

### Backend
- **API Framework**: FastAPI (Python)
- **Audio Processing**: Praat/Parselmouth (acoustic analysis)
- **Speech Recognition**: Faster Whisper (OpenAI Whisper optimized)
- **Server**: Uvicorn (ASGI)
- **Database**: SQLite (patient queue storage)
- **Audio Format**: WAV (16kHz mono, encoded in browser)

### Analysis Methods
- **Praat**: Acoustic feature extraction (jitter, shimmer, HNR, speech rate, etc.)
- **Whisper**: Speech-to-text transcription for English and Arabic
- **WER Calculator**: Word Error Rate calculation with language-specific normalization
- **Agreement Scoring**: Multi-method consensus validation

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Python**: >= 3.9
- **pip**: >= 23.0

**Note**: FFmpeg is **NOT required**. Audio encoding is handled entirely in the browser using the Web Audio API and custom WAV encoder.

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/nabrah.git
cd nabrah/nabrah-app
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Setup Python Backend

```bash
cd python-backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Dependencies Installed**:
- `fastapi==0.104.1` - Modern Python web framework
- `uvicorn[standard]==0.24.0` - ASGI server
- `praat-parselmouth==0.4.3` - Praat acoustic analysis
- `numpy==1.24.3` - Numerical computing
- `python-multipart==0.0.6` - File upload handling
- `faster-whisper>=0.10.0` - Optimized Whisper speech recognition (optional)

**Note**: First-time setup will download Whisper models (~40MB for tiny.en, ~75MB for tiny multilingual) if Whisper features are used.

### 4. Environment Configuration (Optional)

The `.env.local` file is **optional** for local development. The frontend defaults to `http://localhost:8000` for the backend URL.

If you want to customize the backend URL:

```bash
# Create .env.local in the nabrah-app root directory
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, update this to your deployed Python backend URL.

---

## 🎮 Running the Application

### Development Mode

You need **two terminal windows** running simultaneously:

**Terminal 1 - Python Backend:**
```bash
cd python-backend
python server.py
```
✅ Backend starts at `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/`

**Terminal 2 - Next.js Frontend:**
```bash
# From nabrah-app root directory
npm run dev
```
✅ Frontend starts at `http://localhost:3000`

### Production Build

**Frontend:**
```bash
# Build the Next.js application
npm run build

# Start production server
npm start
```

**Backend:**
```bash
cd python-backend

# Option 1: Using the built-in server
python server.py

# Option 2: Using uvicorn directly (recommended for production)
uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📂 Project Structure

```
nabrah-app/
├── app/
│   ├── page.tsx                      # Landing page (bilingual)
│   ├── check/
│   │   └── page.tsx                  # Main triage interface
│   ├── queue/
│   │   └── page.tsx                  # Clinical queue management
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts              # Audio analysis API endpoint
│   ├── layout.tsx                    # Root layout with LanguageProvider
│   └── globals.css                   # Global styles + RTL support
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── progress.tsx
│   │   └── badge.tsx
│   ├── AudioRecorder.tsx             # Voice recording with WAV encoding
│   ├── TriageResult.tsx              # Triage result display
│   ├── FeatureDashboard.tsx          # Acoustic features visualization
│   ├── LanguageSwitcher.tsx          # English/Arabic toggle
│   ├── RecordingQualityIndicator.tsx # Real-time audio quality
│   ├── PreScreeningQuestionnaire.tsx # Pre-screening questions
│   ├── PatientCard.tsx               # Queue patient cards
│   ├── PatientList.tsx               # Queue list view
│   └── QueueSummary.tsx              # Queue statistics
├── lib/
│   ├── i18n/                         # Internationalization
│   │   ├── index.ts                  # Language context & provider
│   │   ├── types.ts                  # Translation types
│   │   ├── en.ts                     # English translations
│   │   ├── ar.ts                     # Arabic translations
│   │   └── prompts.ts                # Recording prompts (en/ar)
│   ├── audioUtils.ts                 # WAV encoding/resampling (no FFmpeg!)
│   ├── triageLogic.ts                # Triage scoring (language-aware)
│   ├── thresholds.ts                 # Language-specific acoustic thresholds
│   ├── werCalculator.ts              # WER calculation
│   ├── agreementScore.ts             # Multi-method consensus
│   ├── questionnaireLogic.ts         # Pre-screening logic
│   ├── queueApi.ts                   # Queue API client
│   ├── patientTypes.ts               # Patient data types
│   └── utils.ts                      # Utility functions
├── python-backend/
│   ├── server.py                     # FastAPI server (Praat + Whisper)
│   ├── queue_db.py                   # SQLite patient queue database
│   ├── requirements.txt              # Python dependencies
│   └── nabrah_queue.db               # SQLite database (auto-created)
├── public/                           # Static assets
├── .env.local                        # Environment variables (optional)
├── package.json                      # Node dependencies
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.ts                # Tailwind CSS configuration
└── README.md                         # This file
```

---

## 🔬 How It Works

### 1. Browser-Based Audio Encoding (No FFmpeg!)

**Recording Flow**:
1. User grants microphone permission
2. Web Audio API captures audio at hardware native sample rate (typically 48kHz)
3. Audio chunks stored in memory as Float32Arrays
4. On recording stop:
   - Browser creates AudioBuffer from captured chunks
   - Custom WAV encoder resamples to 16kHz mono (Praat requirement)
   - WAV headers written in browser using DataView
   - Result: WAV blob ready for backend analysis

**Benefits**:
- ✅ No server-side FFmpeg installation required
- ✅ Lightweight deployment
- ✅ Works on any platform (Windows, macOS, Linux)
- ✅ Faster processing (no file conversion overhead)

**Implementation**: See `lib/audioUtils.ts` for WAV encoding logic.

### 2. Acoustic Feature Extraction (Praat)

The system analyzes the following features using Praat/Parselmouth:

| Feature | Description | Normal Range | Clinical Significance |
|---------|-------------|--------------|----------------------|
| **Jitter (local)** | Voice frequency stability | < 1.040% | Neurological control of vocal cords |
| **Shimmer (local)** | Voice amplitude stability | < 3.810% | Muscle strength and coordination |
| **HNR** | Harmonics-to-noise ratio | ≥ 7 dB | Vocal cord health and clarity |
| **Speech Rate** | Syllables per second | ≥ 2.5 syl/s | Word formation ability |
| **Pause Ratio** | Percentage of silence | < 18% | Breathing patterns and fatigue |
| **Voice Breaks** | Number of discontinuities | 0 (any breaks pathological) | Vocal cord function |
| **Mean Intensity** | Average volume (dB) | 50-80 dB | Overall voice strength |

**Research-Backed Thresholds**:
- **Jitter**: [Praat Voice Analysis](https://www.fon.hum.uva.nl/praat/manual/Voice_2__Jitter.html)
- **Shimmer**: [Praat Shimmer Documentation](https://www.fon.hum.uva.nl/praat/manual/Voice_3__Shimmer.html)
- **HNR**: [Fonetika Study](https://fonetika.ff.cuni.cz) - < 7 dB pathological
- **Pause Ratio**: [PMC Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC5530595/) - > 17-18% abnormal
- **Voice Breaks**: [Praat Voice Breaks](https://www.fon.hum.uva.nl/praat/manual/Voice_1__Voice_breaks.html)

### 3. Speech Recognition (Whisper)

- **English**: Uses `tiny.en` model (fast, English-only)
- **Arabic**: Uses `tiny` multilingual model
- **Output**: Transcription + confidence scores (avg_logprob, no_speech_prob)

### 4. Word Error Rate (WER) Calculation

Compares transcription against expected prompt using Levenshtein distance:

**English Prompt**: "Today is Monday. I need medical help."

**Arabic Prompt**: "اليوم يوم الاثنين. أحتاج مساعدة طبية."

**Arabic Text Normalization**:
- Remove diacritics (tashkeel): ًٌٍَُِّْ
- Normalize alef variations: أ، إ، آ → ا
- Normalize yaa/alef maqsura: ى → ي
- Remove tatweel: ـ
- Normalize taa marbouta: ة → ه

**WER Thresholds**:
- **English**: ≤15% GREEN (normal), ≤30% YELLOW (mild), ≤50% RED (moderate), >50% RED_SEVERE
  - Baseline: Whisper tiny.en ~15% WER on LibriSpeech test-other
- **Arabic**: ≤20% GREEN (within MSA baseline), ≤40% YELLOW (elevated), >40% RED (very high)
  - Baseline: Talafha et al. ~13-17% WER on MSA benchmarks, ~31% on harder conditions

### 5. Triage Scoring System

**RED (Emergency) - Score >= 10**
- Shimmer > threshold (+5 points)
- Pause ratio > threshold (+5 points)
- **Action**: SEEK IMMEDIATE EMERGENCY CARE

**YELLOW (Urgent) - Score >= 5**
- Jitter > threshold (+2 points)
- HNR < threshold (+2 points)
- Speech rate < threshold (+1 point)
- Voice breaks >= 2 (+1 point)
- High WER (+2-3 points)
- **Action**: SCHEDULE URGENT MEDICAL EVALUATION

**GREEN (Normal) - Score < 5**
- All features within normal ranges
- **Action**: No urgent concerns detected

### 6. Multi-Method Agreement

Validates results across multiple methods:
- **Praat**: Acoustic analysis
- **Whisper**: Transcription confidence
- **WER**: Speech intelligibility
- **Quality**: SNR and VAD metrics

**Consensus Levels**:
- **Unanimous**: All methods agree (confidence +10%)
- **Strong**: Most methods agree (confidence unchanged)
- **Conflicting**: Methods disagree (confidence -15%)

### 7. Clinical Queue System

SQLite-based patient queue with:
- **Priority Sorting**: RED (1-3) > YELLOW (4-6) > GREEN (7-9)
- **Status Tracking**: pending, reviewing, completed, referred
- **Queue Statistics**: Real-time counts by triage level and status
- **CSV Export**: Download queue data for analysis
- **Patient Data**: Full triage results, audio quality, Whisper transcription, WER scores

---

## 🌍 Language Support

### Switching Languages

Users can toggle between English and Arabic using the language switcher (Globe icon) in the top-right corner.

**Persistence**: Language preference is saved to `localStorage` as `nabrah-language`.

### Recording Prompts

**English**: "Today is Monday. I need medical help."

**Arabic (MSA)**: "اليوم يوم الاثنين. أحتاج مساعدة طبية."

Prompts are designed to:
- Include varied phonemes for comprehensive analysis
- Be medically relevant
- Be easy to remember under stress
- Be culturally appropriate

### Bilingual Reports

When Arabic is selected, technical terms appear in both languages:

**English Mode**:
```
Jitter: 1.2%
Explanation: Voice steadiness - how consistent your vocal cords vibrate
```

**Arabic Mode**:
```
Jitter (الارتعاش): 1.2%
شرح: ثبات الصوت - مدى انتظام اهتزاز الأحبال الصوتية
```

This approach:
- Maintains medical terminology recognition
- Provides accessibility for Arabic-speaking patients
- Ensures clarity for multilingual healthcare teams

---

## 🧪 Testing

### Manual Testing Checklist

**Basic Functionality**:
- [ ] Landing page loads correctly in English
- [ ] Switch to Arabic - RTL layout works correctly
- [ ] "Start Nabrah Check" button navigates to /check
- [ ] Microphone permission request appears
- [ ] Audio recording starts with countdown
- [ ] Waveform visualization displays
- [ ] Recording auto-stops at 5 seconds
- [ ] Analysis loading state displays
- [ ] Triage result shows correct color (RED/YELLOW/GREEN)
- [ ] Feature dashboard displays all metrics
- [ ] Download report button works (bilingual)
- [ ] "New Check" button returns to recording
- [ ] Mobile layout works (test at 320px width)

**Bilingual Testing**:
- [ ] All UI text translates correctly
- [ ] Arabic font renders properly (Noto Sans Arabic)
- [ ] RTL layout: text alignment, icon positioning, margins
- [ ] Language preference persists on page reload
- [ ] Recording prompt displays in correct language
- [ ] Triage report shows bilingual feature labels (Arabic mode)
- [ ] Layman explanations display in correct language

### Backend Testing

Test endpoints independently:

```bash
# Health check
curl http://localhost:8000/

# Praat analysis
curl -X POST http://localhost:8000/analyze \
  -F "file=@sample.wav"

# Whisper transcription (English)
curl -X POST "http://localhost:8000/analyze/whisper?language=en" \
  -F "file=@sample.wav"

# Whisper transcription (Arabic)
curl -X POST "http://localhost:8000/analyze/whisper?language=ar" \
  -F "file=@sample_arabic.wav"

# Queue endpoints
curl http://localhost:8000/queue                    # Get all patients
curl http://localhost:8000/queue/stats/summary     # Get queue stats
curl http://localhost:8000/queue/export/csv        # Export as CSV
```

### Performance Testing

```bash
# Build production bundle
npm run build

# Run production server
npm start

# Open browser DevTools → Lighthouse → Run audit
```

**Target Metrics**:
- First Contentful Paint: < 1.5s
- Time to Interactive: < 2.5s
- Bundle Size: < 150KB gzipped
- Lighthouse Score: > 90
- Analysis Time: 3-5 seconds end-to-end

---

## 🚢 Deployment

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL production
# Enter your backend URL (e.g., https://api.nabrah.com)
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_API_URL": "@api-url"
  }
}
```

### Backend Deployment (Render/Railway)

**Render Setup**:
1. Create new Web Service
2. Connect GitHub repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn server:app --host 0.0.0.0 --port $PORT --workers 4`
5. Add environment variables:
   - `PORT=8000` (Render provides this automatically)

**Railway Setup**:
1. Create new Python service
2. Set start command: `python server.py`

**Production CORS Configuration** (`python-backend/server.py`):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nabrah.vercel.app",  # Your production frontend
        "http://localhost:3000"        # Keep for local testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## ⚠️ Medical Disclaimer

**CRITICAL NOTICE**: Nabrah is a triage support tool designed to assist emergency decision-making. It does **NOT** replace professional medical diagnosis or treatment.

### Important Guidelines

✅ **DO USE** Nabrah as:
- A supplementary decision-support tool
- A pre-screening mechanism
- An additional data point for triage

❌ **DO NOT USE** Nabrah as:
- A replacement for professional medical diagnosis
- The sole basis for treatment decisions
- A substitute for emergency services

### Emergency Protocol

🚨 **If experiencing a life-threatening emergency**:
- **Call emergency services immediately** (911 in US, 999 in Gulf region)
- Do not delay emergency care to use this tool
- Always prioritize professional medical assessment

### Limitations

- Voice analysis cannot detect all medical conditions
- Results may be affected by:
  - Environmental noise
  - Microphone quality
  - User's ability to speak
  - Temporary conditions (cold, fatigue, stress)
- System has not been clinically validated for diagnostic use

**Use Nabrah responsibly and always seek professional medical advice.**

---

## 🤝 Contributing

Contributions are welcome! This project is actively developed and we appreciate:

### Areas for Contribution

- **Additional Languages**: Support for Spanish, French, Chinese, etc.
- **Clinical Validation**: Studies comparing Nabrah results to clinical outcomes
- **Feature Enhancements**: Additional acoustic features, ML models
- **Mobile Apps**: Native iOS/Android implementations
- **Performance**: Bundle size reduction, faster analysis
- **Accessibility**: Screen reader support, keyboard shortcuts
- **Documentation**: Tutorials, API docs, clinical guides

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`, `pytest`)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- **TypeScript**: Follow Next.js conventions, use TypeScript strict mode
- **Python**: Follow PEP 8, use type hints
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `docs:`)
- **Testing**: Add tests for new features

---

## 📄 License

MIT License

Copyright (c) 2026 Nabrah Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 🏆 Credits & Acknowledgments

### Technologies

Built with these amazing open-source projects:

- **[Next.js](https://nextjs.org/)** by Vercel - React framework for production
- **[FastAPI](https://fastapi.tiangolo.com/)** by Sebastián Ramírez - Modern Python web framework
- **[Praat/Parselmouth](https://github.com/YannickJadoul/Parselmouth)** by Yannick Jadoul - Acoustic analysis
- **[Whisper](https://github.com/openai/whisper)** by OpenAI - Speech recognition
- **[Faster Whisper](https://github.com/guillaumekln/faster-whisper)** by Guillaume Klein - Optimized Whisper
- **[shadcn/ui](https://ui.shadcn.com/)** by shadcn - Beautiful UI components
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Framer Motion](https://www.framer.com/motion/)** - Animation library
- **[Lucide](https://lucide.dev/)** - Icon library
- **[TypeScript](https://www.typescriptlang.org/)** by Microsoft - Type-safe JavaScript

### Fonts

- **[Geist Sans/Mono](https://vercel.com/font)** by Vercel - Modern sans-serif and monospace fonts
- **[Noto Sans Arabic](https://fonts.google.com/noto/specimen/Noto+Sans+Arabic)** by Google Fonts - Arabic typography

### Research

Acoustic analysis thresholds based on:
- Praat voice analysis guidelines
- Clinical speech pathology research
- Language-specific phonetic studies

### Team

Developed with ❤️ by the Nabrah Team for emergency voice triage assistance.

---

**Nabrah (نبرة)** - *"5 seconds to check, peace of mind delivered"*

© 2026 Nabrah Team | [MIT License](LICENSE)
