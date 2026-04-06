# AdmitGuard: An AI-Powered Distributed Governance Framework for High-Integrity Admissions

## 📄 Abstract
AdmitGuard introduces a novel, distributed approach to admissions governance, leveraging a combination of **edge-validation algorithms**, **multi-stage AI reasoning**, and **latent semantic search**. By distributing rule enforcement to the point of data entry (Chrome Extension) and centralizing decision-making through an AI-augmented dashboard and mobile counselor suite, the framework mitigates data entry errors, prevents identity spoofing, and provides management with deep, context-aware insights into admissions trends.

---

## 1. Technical Infrastructure & Component Matrix

### 🚀 Core Technologies Leveraged
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white) 
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white) 
![JavaScript](https://img.shields.io/badge/javascript-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black) 
![React Native](https://img.shields.io/badge/react_native-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Expo](https://img.shields.io/badge/expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![Chrome](https://img.shields.io/badge/chrome%20extension-%234285F4.svg?style=for-the-badge&logo=google-chrome&logoColor=white) 
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) 
![Redis](https://img.shields.io/badge/Upstash_Redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Twilio](https://img.shields.io/badge/Twilio_WhatsApp-F22F46?style=for-the-badge&logo=twilio&logoColor=white)
![Resend](https://img.shields.io/badge/Resend_Email-000000?style=for-the-badge&logo=resend&logoColor=white)
![Sentry](https://img.shields.io/badge/Sentry-362D59?style=for-the-badge&logo=sentry&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) 
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![Groq](https://img.shields.io/badge/Groq%20AI-%23f26522.svg?style=for-the-badge&logo=ai&logoColor=white)
![Llama 3](https://img.shields.io/badge/Llama--3.3--70B-blue?style=for-the-badge&logo=meta&logoColor=white)
![Auth](https://img.shields.io/badge/Google--OAuth--2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Nodejs](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![HuggingFace](https://img.shields.io/badge/%F0%9F%A4%97%20Xenova_Embed-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![PDFKit](https://img.shields.io/badge/PDFKit-red?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)

### 🗺️ System Architecture
![Architecture](Architecture.png)

| Module | Technology | Functional Role |
| :--- | :--- | :--- |
| **Edge Client** | ![JS](https://img.shields.io/badge/JS-F7DF1E) ![Chrome](https://img.shields.io/badge/Chrome-4285F4) | Browser extension for real-time governance & local draft persistence |
| **Counselor App** | ![React Native](https://img.shields.io/badge/React_Native-20232a) ![Expo](https://img.shields.io/badge/Expo-000020) | Mobile suite for on-the-go submission audit & staff tracking |
| **Command Center** | ![Auth](https://img.shields.io/badge/OIDC-4285F4) ![HTML](https://img.shields.io/badge/HTML5-E34F26) | Secured Admin dashboard with PII masking & Pipeline management |
| **Backend Core** | ![Node](https://img.shields.io/badge/Node.js-339933) ![Express](https://img.shields.io/badge/Express-000000) | API Orchestration, JWT Auth, and System Coordination |
| **Persistence** | ![Supabase](https://img.shields.io/badge/Postgres-316192) ![pgvector](https://img.shields.io/badge/pgvector-336791) | Relational storage & high-dimensional vector similarity |
| **Automation** | ![Twilio](https://img.shields.io/badge/WhatsApp-F22F46) ![Resend](https://img.shields.io/badge/Email-000000) | Real-time notifications & Automated Admission Letters (PDF) |
| **Sync & Cache** | ![Socket](https://img.shields.io/badge/Socket.io-010101) ![Redis](https://img.shields.io/badge/Upstash-DD0031) | Bi-directional real-time sync & low-latency rule delivery |
| **Observability** | ![Sentry](https://img.shields.io/badge/Sentry-362D59) ![Docker](https://img.shields.io/badge/Docker-0db7ed) | Enterprise error tracking & containerized deployment |
| **Inference Layer** | ![Groq](https://img.shields.io/badge/Groq-f26522) ![Llama](https://img.shields.io/badge/Llama3-0668E1) | RAG Pipeline, SQL Generation, and Semantic Trend Analysis |

---

## 2. Introduction
The student admissions process in modern institutions is fraught with two primary challenges: **Data Entry Integrity** and **Auditability**. Conventional systems rely on post-facto verification, which is both slow and prone to oversight. AdmitGuard addresses these by implementing a **"Governance-at-the-Source"** model. This framework ensures that any deviation from predetermined academic or institutional criteria is flagged instantly and requires a human-provided, AI-audited rationale for submission.

---

## 3. System Architecture & Methodology
AdmitGuard is architected as a four-tier distributed system ensuring zero-latency validation and high-resolution oversight.

### 3.1 Tier 1: The Edge Client (Chrome Extension)
Operating directly at the point of data entry, the extension uses a dual-plane logic:
*   **Hard-Rule Plane**: Deterministic algorithms (including Verhoeff checksums for IDs) to block invalid data.
*   **Soft-Rule Plane**: Evaluates candidate profiles against cloud-synced rules. If a violation is detected (e.g., age or GPA), it mandates a **Rationale Keyword Match** before allowing submission.

### 3.2 Tier 2: Counselor Suite (Mobile App)
A dedicated **React Native/Expo** application for field officers:
*   **Personal Submission Stream**: Counselors view their own filtered audit logs via secure JWT-authenticated sessions.
*   **Real-time Decision Sync**: Leveraging **Socket.io**, counselors receive instant push-like updates when a manager approves or rejects their submitted candidates.
*   **Biometric-ready Security**: Built with `expo-secure-store` to maintain high-integrity credential management.

### 3.3 Tier 3: Command Center (Admin Dashboard)
A centralized web interface for institutional managers:
*   **PII Masking Canvas**: Dynamically hides sensitive fields (email, phone, Aadhaar) to ensure GDPR/FERPA compliance during initial auditing.
*   **Kanban Pipeline**: Drag-and-drop state management for candidates moving from `Pending` to `Approved`.
*   **Rule Sculpting**: Managers can modify eligibility thresholds (GPA, Age, keywords) which are propagated to all clients in real-time via Redis and WebSockets.

### 3.4 Tier 4: Autonomous Backend & Automation
The Node.js core acts as the "Central Intelligence Agency":
*   **Vectorized Rationale Store**: Converts rationale strings into 384-dimensional vectors using **Xenova/all-MiniLM-L6-v2**.
*   **Admission Letter Engine**: Uses **PDFKit** to generate professionally branded, internally signed admission certificates upon approval.
*   **Multi-Channel Outreach**: Integrates **Resend (Email)** and **Twilio (WhatsApp)** to keep candidates informed at every pipeline stage.

---

## 4. Advanced Algorithms & Security

### 4.1 Verhoeff Checksum Integration
To prevent transcription errors in identity documents (e.g., Aadhaar), AdmitGuard implements the **Verhoeff Algorithm**. It utilizes the Dihedral group $D_5$ to catch 100% of single-digit errors and 95.5% of adjacent transposition errors, ensuring "Identity Integrity" at the edge.

### 4.2 Real-time State Synchronization (WebSockets)
Unlike traditional polling, AdmitGuard maintains a persistent **Socket.io** connection across all components.
*   **Staff Registry**: Real-time tracking of counselor activity.
*   **Live Audit Feed**: Submissions appear on the Manager's dashboard instantly the moment they are entered in the browser extension.

### 4.3 Semantic Reasoning & RAG
The "AI Insights" panel uses a **Retrieval-Augmented Generation (RAG)** workflow:
1.  **Intent Decoder**: Analyzes manager queries to decide between SQL execution (Quant) or Semantic Search (Qual).
2.  **pgvector Search**: Performs cosine similarity search across candidate rationales to identify hidden patterns (e.g., *"Why are so many 2024 graduates failing the GPA rule?"*).
3.  **Synthesis**: Combines raw database counts with AI-detected trends to suggest rule optimizations.

---

## 5. Logic Flow & Infrastructure

### 5.1 Admission-to-Letter Pipeline
```mermaid
graph TD
    A[Extension Entry] --> B{Edge Rules?}
    B -- FAIL --> C[Block/ rationale required]
    B -- PASS --> D[Socket: Dispatch to Server]
    D --> E[WhatsApp: Receipt Sent]
    E --> F[Admin: Oversight Audit]
    F -- APPROVE --> G[Generate PDF Certificate]
    G --> H[Resend: Email Letter]
    G --> I[WhatsApp: Decision Alert]
    F -- REJECT --> J[Notify Candidate]
```

### 5.2 Real-time Sync Architecture
```mermaid
graph LR
    A[Admin Dashboard] <-->|Socket.io| B[Express Backend]
    B <-->|Socket.io| C[Mobile Staff App]
    B <-->|Socket.io| D[Edge Client]
    B ---|Cache| E[(Upstash Redis)]
    B ---|Storage| F[(Supabase Postgres)]
    B ---|Inference| G[Groq Llama 3]
```

---

## 6. Deployment & Scalability

AdmitGuard is architected for institutional scale with a multi-cloud topology:
*   **Frontend (Vercel)**: Global CDN for the Command Center.
*   **Compute (Render)**: Auto-scaling Node.js backend.
*   **Database (Supabase)**: Multi-region Postgres with pgvector support.
*   **Caching (Upstash)**: Global Redis for rule-syncing (<10ms latency).
*   **Observability (Sentry)**: Full-stack error monitoring and performance profiling.
*   **Containerization (Docker)**: Standardized environment for the backend core.

---

## 7. Conclusions
AdmitGuard represents a shift in admissions technology from passive record-keeping to **active, automated governance**. By combining deterministic algorithms like Verhoeff with stochastic AI models like Llama 3 and real-time triggers via Twilio/Redis, the framework provides a "Human-in-the-Loop" system that is both rigid in its compliance and frictionless in its communication.

---
*Technical Documentation for the AdmitGuard Project — High-Integrity Admissions Distributed Framework.*
