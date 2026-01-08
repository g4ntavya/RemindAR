"""
Fast LLM Extraction using Ollama + Phi-3
Optimized for <2 second response
"""

import httpx
import json
import re
from dataclasses import dataclass
from typing import Optional

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3:mini"  # Smaller, faster model

# Ultra-minimal prompt
PROMPT = '''JSON only: {{"name":"X","relation":"Y","context":"Z"}}
Extract from: "{text}"'''


@dataclass
class ExtractedInfo:
    name: Optional[str] = None
    relation: Optional[str] = None
    context: Optional[str] = None


# Reusable client for connection pooling
_client: Optional[httpx.AsyncClient] = None

async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=30.0)
    return _client


async def extract_info_async(sentence: str) -> ExtractedInfo:
    """Fast extraction - target <2s response."""
    if not sentence or len(sentence.strip()) < 3:
        return ExtractedInfo()
    
    prompt = PROMPT.format(text=sentence.strip())
    
    try:
        client = await get_client()
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0,
                    "num_predict": 50,  # Very short
                    "top_k": 1,
                }
            }
        )
        
        if response.status_code != 200:
            print(f"[LLM] Error: {response.status_code}")
            return ExtractedInfo()
        
        raw = response.json().get("response", "")
        print(f"[LLM] {raw}")
        
        # Parse JSON
        match = re.search(r'\{[^{}]*\}', raw)
        if not match:
            return ExtractedInfo()
        
        data = json.loads(match.group(0))
        
        name = data.get("name")
        relation = data.get("relation")
        context = data.get("context")
        
        # Clean null/empty
        if name in [None, "null", "", "X"]: name = None
        if relation in [None, "null", "", "Y"]: relation = None
        if context in [None, "null", "", "Z"]: context = None
        
        return ExtractedInfo(name=name, relation=relation, context=context)
        
    except Exception as e:
        print(f"[LLM] Error: {e}")
        return ExtractedInfo()
