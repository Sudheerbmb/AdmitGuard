# AdmitGuard: An AI-Powered Distributed Governance Framework for High-Integrity Admissions

## 📄 Abstract
AdmitGuard introduces a novel, distributed approach to admissions governance, leveraging a combination of **edge-validation algorithms**, **multi-stage AI reasoning**, and **latent semantic search**. By distributing rule enforcement to the point of data entry (Chrome Extension) and centralizing decision-making through an AI-augmented dashboard, the framework mitigates data entry errors, prevents identity spoofing, and provides management with deep, context-aware insights into admissions trends.

---

## 1. Technical Infrastructure & Component Matrix

### 🚀 Core Technologies Leveraged
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white) 
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white) 
![JavaScript](https://img.shields.io/badge/javascript-%23F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black) 
![Chrome](https://img.shields.io/badge/chrome%20extension-%234285F4.svg?style=for-the-badge&logo=google-chrome&logoColor=white) 
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) 
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Twilio](https://img.shields.io/badge/Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white)
![Sentry](https://img.shields.io/badge/Sentry-362D59?style=for-the-badge&logo=sentry&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white) 
![Vector](https://img.shields.io/badge/pgvector-%23336791.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Groq](https://img.shields.io/badge/Groq%20AI-%23f26522.svg?style=for-the-badge&logo=ai&logoColor=white)
![Llama 3](https://img.shields.io/badge/Llama--3.3--70B-blue?style=for-the-badge&logo=meta&logoColor=white)
![Auth](https://img.shields.io/badge/Google--OAuth--2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Nodejs](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![HuggingFace](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white) 
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

| Module | Technology | Functional Role |
| :--- | :--- | :--- |
| **Edge Engine** | ![JS](https://img.shields.io/badge/JS-F7DF1E?logo=javascript&logoColor=black) ![Chrome](https://img.shields.io/badge/Chrome-4285F4?logo=googlechrome&logoColor=white) | Real-time governance & local draft persistence |
| **Command Center** | ![Auth](https://img.shields.io/badge/Google-4285F4?logo=google&logoColor=white) ![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) | Secured Admin dashboard with JWT session state |
| **Backend Core** | ![Node](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white) | Identity Verification (OIDC) & API Orchestration |
| **Persistence** | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white) ![pgvector](https://img.shields.io/badge/pgvector-336791) | Transactional storage & high-dim vector similarity |
| **Automation** | ![Twilio](https://img.shields.io/badge/Twilio-F22F46?logo=twilio&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white) | Real-time notifications & low-latency rule caching |
| **Observability** | ![Sentry](https://img.shields.io/badge/Sentry-362D59?logo=sentry&logoColor=white) | Enterprise-grade error tracking & performance metrics |
| **Inference Layer** | ![Groq](https://img.shields.io/badge/Groq-f26522) ![Llama](https://img.shields.io/badge/Llama3-0668E1) | Natural Language Reasoning & SQL Planning |

---

## 2. Introduction
The student admissions process in modern institutions is fraught with two primary challenges: **Data Entry Integrity** and **Auditability**. Conventional systems rely on post-facto verification, which is both slow and prone to oversight. AdmitGuard addresses these by implementing a **"Governance-at-the-Source"** model. This framework ensures that any deviation from predetermined academic or institutional criteria is flagged instantly and requires a human-provided, AI-audited rationale for submission.

---

## 3. System Architecture & Methodology
AdmitGuard is architected as a three-tier distributed system comprising an Edge Client, a Vectorized Backend, and an Oversight Dashboard.

### 3.1 The Edge Client (Chrome Extension)
The client-side engine is responsible for real-time validation. It operates on two distinct logical planes:
*   **Hard-Rule Plane (Strict Validation)**: Uses deterministic algorithms to prevent non-compliant data from being submitted.
*   **Soft-Rule Plane (Conditional Exception)**: Dynamically evaluates candidate profiles against cloud-synchronized rules (Age, GPA, Graduation Year). If a "soft violation" occurs, a state-machine prevents submission until a valid **Exception Rationale** is provided.

### 3.2 Managerial Oversight & Advanced Analytics Interface (Admin Dashboard)
A centralized command-and-control dashboard structured to facilitate high-resolution auditing and decision-making. 
*   **Granular PII Masking Architecture**: To maintain GDPR and institutional data privacy compliance, the interface implements a one-click **PII Layer** that dynamically masks sensitive identifying fields (Email, Aadhaar, Phone) during the initial audit phase.
*   **Operational Pipeline Management**: Implements a state-machine driven **Pipeline View** (Kanban style). It allows managers to visually transition candidates between `Pending`, `Flagged`, `Approved`, and `Rejected` statuses, ensuring zero-loss pipeline visibility.
*   **Real-time Intelligence Integration**: Directly interfaces with the **Groq-powered RAG engine**, providing an interactive sidebar where managers can ask complex structural questions like *"Identify all 2024 graduates with inconsistent screening scores"* and receive immediate, linked profile recommendations.
*   **Adaptive Rule Sculpting**: Enables managers to modify institutional criteria (thresholds, keyword requirements, checksum toggles) instantly. These changes are versioned and propagated to all Edge Clients upon their next polling cycle.

---

## 4. Data Integrity & Algorithms
AdmitGuard employs sophisticated mathematical models to ensure data validity.

### 4.1 Verhoeff Error Detection
To combat identity document fraud (e.g., Aadhaar entry), the framework implements the **Verhoeff Algorithm**. Unlike simple modulo-based checks, Verhoeff uses a non-commutative group $D_5$ (Dihedral group of order 10).
*   **Permutation Table**: Rotates digits to catch transcription errors.
*   **D5 Multiplication**: Ensures that single-digit errors and most adjacent transposition errors are detected.

### 4.2 Dynamic Rule Synchronization
The system uses a polling-and-cache mechanism to ensure that the Edge Client always has the latest institutional criteria. Rules are stored in the backend as `JSONB` structures, allowing for field-level flexibility without schema migrations.

---

## 5. AI & Semantic Reasoning Engine
The core intelligence of AdmitGuard is built upon a **Retrieval-Augmented Generation (RAG)** pipeline.

### 5.1 Rationale Vectorization
When an officer provides a justification for a rule exception, the string is processed through the **Xenova `all-MiniLM-L6-v2`** model. This generates a 384-dimensional dense vector representing the "semantic weight" of the justification.
$$v = \text{Embed}(\text{Rationale})$$
These vectors are stored in a **PostgreSQL `vector`** column, allowing for cosine similarity queries.

### 5.2 Multi-Stage AI Reasoning (Groq Llama 3)
The AI Assistant (`/api/analyze`) uses a specialized agentic workflow to answer manager queries:
1.  **Intent Classification**: The agent analyzes if the user is asking for **Quantitative** (e.g., "Top 5 scores") or **Qualitative** (e.g., "Trends in grad year waivers") data.
2.  **Query Generation**:
    *   **SQL Generation**: For quantitative queries, the AI writes and executes PostgreSQL queries against the JSONB fields.
    *   **Vector Search**: For qualitative queries, it performs a similarity search ($1 - \text{cosine\_distance}$) to retrieve the most semantically relevant candidate files.
3.  **Synthesis**: The final response combines raw numerical data with latent pattern recognition (e.g., *"There is a 30% increase in GPA waivers for 2024 graduates, suggesting the current threshold may be statistically too high"*).

---

## 6. Authentication & Identity Governance
To ensure institutional record-keeping is protected from unauthorized access, AdmitGuard implements a **Public Intake, Private Audit** security model:

*   **Google OAuth 2.0 Integration**: The Admin Dashboard requires a valid Google Identity token to initialize. Sessions are cryptographically verified using Google's OpenID Connect (OIDC) protocol.
*   **Zero-Trust Whitelisting**: Access to the core data APIs (Rules, Analysis, Pipeline) is restricted to pre-authorized administrator emails managed via secure environment variables (`ADMIN_EMAILS`).
*   **Hybrid Endpoint Access**: 
    *   **Ingress (Public)**: The `POST /api/submissions` endpoint is open to allow seamless data intake from the distributed browser extensions.
    *   **Egress (Secured)**: All diagnostic, analytics, and decision-making endpoints require a valid Bearer token, preventing data exfiltration even if the API endpoint is publicly discovered.

---

## 7. Deployment & Distributed Cloud Topology

To ensure institutional-grade availability and low-latency inference, AdmitGuard implements a multi-cloud distribution strategy:

### 🗺️ Infrastructure Stack
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white) 
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash-00E9A3?style=for-the-badge&logo=upstash&logoColor=white)

*   **Persistence Layer (Supabase)**: The PostgreSQL instance, along with the `pgvector` semantic store, is hosted on **Supabase**. This provides high-performance vectorized operations with integrated connection pooling and real-time data synchronization.
*   **Application Compute (Render)**: The Node.js/Express.js backend resides on **Render**, serving as the secure orchestrator between client requests, database transactions, and high-speed external APIs.
*   **Global Caching (Upstash Redis)**: Low-latency rule delivery and rate-limiting are handled by **Upstash Redis**, ensuring the Edge Client receives governance updates in <10ms.
*   **Managerial Portal (Vercel)**: The Administrative Dashboard (Frontend) is distributed via **Vercel's global CDN**, ensuring instantaneous loading of candidate pipelines and analytics.
*   **Governance Edge (Chrome Web Store)**: The browser extension is distributed as a hardened package, enabling localized rule enforcement directly within the officer's browser environment.

---

## 8. Logic Flow & State Diagrams

### 8.1 Submission Validation Flow
```mermaid
graph TD
    A[Data Entry] --> B{Hard Rules?}
    B -- FAIL --> C[Block Submission]
    B -- PASS --> D{Soft Rules?}
    D -- FAIL --> E[Enable Exception Toggle]
    E --> F{Rationale Provided?}
    F -- NO --> G[Hold Submission]
    F -- YES --> H[Submit as FLAGGED]
    D -- PASS --> I[Submit as CLEAN]
```

### 8.2 AI RAG Pipeline
```mermaid
graph LR
    A[Manager Query] --> B[AI Planner]
    B --> C[SQL Executor]
    B --> D[Vector Search]
    C --> E[Data Synthesis]
    D --> E
    E --> F[Final Contextual Answer]
```

---

## 10. Automated Communication & Notification Pipeline

AdmitGuard bridges the gap between institutional decisions and student awareness through an automated **Twilio WhatsApp Pipeline**.

*   **Submission Receipts**: Instant confirmation messages are dispatched the moment a candidate triggers the Edge Engine, reducing candidate anxiety and support volume.
*   **Decision Triggers**: When a manager clicks "Approve" or "Reject" on the Command Center, a background task generates a personalized WhatsApp notification reflecting the specific outcome.
*   **Async Processing**: All notifications are processed asynchronously to ensure that the Managerial Dashboard remains highly responsive even during high-volume notification bursts.

---

## 11. Monitoring & Enterprise Observability

To ensure institutional-grade uptime, AdmitGuard implements a two-tier observability stack:

*   **Real-time Error Tracking (Sentry)**: Every backend exception, AI reasoning failure, or database timeout is captured by **Sentry**. This provides developers with deep stack-traces and candidate context to resolve production issues before they affect the intake pipeline.
*   **Low-Latency Caching (Redis)**: Utilizing the **Least Recently Used (LRU)** eviction policy, Upstash Redis caches institutional rules and AI insights. This prevents "Database Bottlenecks" during peak admission cycles and ensures the system remains "snappy" even under heavy load.

---

## 12. Conclusions
AdmitGuard represents a shift in admissions technology from passive record-keeping to **active, automated governance**. By combining deterministic algorithms like Verhoeff with stochastic AI models like Llama 3 and real-time triggers via Twilio/Redis, the framework provides a "Human-in-the-Loop" system that is both rigid in its compliance and frictionless in its communication.

---
*Technical Documentation & Research Report for the AdmitGuard Project.*
