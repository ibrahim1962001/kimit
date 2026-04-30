"""
chat_service.py
Groq AI integration — all prompt building, API calls, and response parsing live here.
Persists every turn to PostgreSQL chat_messages table.
"""
import json
import uuid
from typing import Optional

from groq import Groq
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.chat_message import ChatMessage

# Module-level Groq client — None if key not configured
_groq: Optional[Groq] = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None

_MODEL = "llama-3.1-70b-versatile"


class ChatService:

    async def get_ai_summary(
        self,
        data_summary: str,
        language: str,
        user_id: int,
        dataset_id: int,
        db: AsyncSession,
    ) -> dict:
        """Generate executive summary + 5 suggested questions."""
        lang_instr = "Respond in Arabic." if language == "ar" else "Respond in English."

        if not _groq:
            return self._fallback_summary(language)

        prompt = f"""{lang_instr}

You are an expert data analyst. Analyse the dataset and respond ONLY with valid JSON matching exactly:
{{
  "summary": "<3-sentence executive summary>",
  "suggestions": ["<q1>","<q2>","<q3>","<q4>","<q5>"]
}}

Dataset info:
{data_summary}"""

        try:
            resp = _groq.chat.completions.create(
                model=_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                max_tokens=600,
            )
            content = resp.choices[0].message.content.strip()
            content = content.removeprefix("```json").removeprefix("```").removesuffix("```")
            return json.loads(content)
        except json.JSONDecodeError:
            return self._fallback_summary(language)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"AI error: {exc}")

    async def chat(
        self,
        question: str,
        data_summary: str,
        language: str,
        user_id: int,
        dataset_id: int,
        session_id: str,
        db: AsyncSession,
    ) -> dict:
        """Answer a free-form question; persist both turns to DB."""
        if not question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        if not _groq:
            msg = ("AI not configured — set GROQ_API_KEY." if language == "en"
                   else "لم يتم تهيئة الذكاء الاصطناعي — أضف GROQ_API_KEY.")
            return {"answer": msg}

        lang_instr = "Respond in Arabic." if language == "ar" else "Respond in English."
        prompt = f"""{lang_instr}
You are a helpful data analyst. Answer concisely (2-3 paragraphs max).

Dataset info:
{data_summary}

User question: {question}"""

        # Persist user turn
        await self._save_message(db, user_id, dataset_id, session_id, "user", question)

        try:
            resp = _groq.chat.completions.create(
                model=_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=400,
            )
            answer = resp.choices[0].message.content or ""
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"AI error: {exc}")

        # Persist assistant turn
        await self._save_message(db, user_id, dataset_id, session_id, "assistant", answer)

        return {"answer": answer}

    async def get_history(
        self,
        session_id: str,
        user_id: int,
        db: AsyncSession,
    ) -> list[dict]:
        """Return all messages for a session, scoped to the authenticated user."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id, ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        msgs = result.scalars().all()
        return [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in msgs]

    # ── Private helpers ──────────────────────────────────────────────────

    async def _save_message(
        self,
        db: AsyncSession,
        user_id: int,
        dataset_id: int,
        session_id: str,
        role: str,
        content: str,
    ) -> None:
        db.add(ChatMessage(
            user_id=user_id,
            dataset_id=dataset_id,
            session_id=session_id,
            role=role,
            content=content,
        ))
        await db.commit()

    def _fallback_summary(self, language: str) -> dict:
        if language == "ar":
            return {
                "summary": "البيانات جاهزة للتحليل.",
                "suggestions": ["ما الاتجاهات الرئيسية؟", "أي الأعمدة تحتوي قيماً مفقودة؟",
                                 "ما توزيع المقاييس الرئيسية؟", "هل توجد علاقات بين الأعمدة؟",
                                 "ما الرؤى التي يمكن استنتاجها؟"],
            }
        return {
            "summary": "The dataset is ready for analysis.",
            "suggestions": ["What are the main trends?", "Which columns have missing values?",
                            "What is the distribution of key metrics?",
                            "Are there correlations between columns?",
                            "What insights can we derive?"],
        }


chat_service = ChatService()
