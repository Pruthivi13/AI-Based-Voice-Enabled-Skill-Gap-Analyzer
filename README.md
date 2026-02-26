# AI Voice Skill Gap Analyzer

A comprehensive AI-driven tool to conduct mock up technical interviews via voice, evaluating the speaker's skill gaps by assessing semantics, structural logic, and acoustic confidence.

## Setup Instructions

Ensure you have Python 3.10+ installed.

1. **Create Virtual Environment**
   ```bash
   python -m venv venv
   ```

2. **Activate Virtual Environment**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS / Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**
   - Copy the `.env.example` structure to a new `.env` file in the root directory.
   - Adjust as necessary (e.g. Models sizes, Audio formatting).

5. **Run the Application**
   ```bash
   streamlit run main.py
   ```
