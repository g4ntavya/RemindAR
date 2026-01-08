"""
LLM-based Information Extraction using Ollama + Phi-3

Extracts structured data (name, relation, context) from natural language sentences.
Used for auto-filling registration forms from Whisper transcriptions.
"""

import httpx
import json
import re
from typing import Optional
from dataclasses import dataclass


OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3"

SYSTEM_PROMPT = """Extract person info from a sentence. Return ONLY JSON.

Output:
{"name": null, "relation": null, "context": null}

Rules:
- name: ONLY the person's name, properly capitalized
- relation: ONE word (Friend, Doctor, Sister, Colleague, Neighbor)
- context: 3-5 words max describing the memory
- No explanations, no extra text
- Use null if unclear

Sentence:
"""


@dataclass
class ExtractedInfo:
    name: Optional[str] = None
    relation: Optional[str] = None
    context: Optional[str] = None


def extract_info(sentence: str) -> ExtractedInfo:
    """
    Extract name, relation, and context from a sentence using Phi-3.
    
    Args:
        sentence: Natural language sentence from Whisper
        
    Returns:
        ExtractedInfo with extracted fields (or nulls if not found)
    """
    if not sentence or not sentence.strip():
        return ExtractedInfo()
    
    prompt = f'{SYSTEM_PROMPT}"{sentence.strip()}"'
    
    try:
        # Call Ollama API
        response = httpx.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,  # Low temperature for deterministic output
                    "num_predict": 100,  # Short response
                }
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            print(f"[LLM] Ollama error: {response.status_code}")
            return ExtractedInfo()
        
        result = response.json()
        raw_output = result.get("response", "")
        
        # Parse JSON from response
        return parse_llm_output(raw_output)
        
    except httpx.ConnectError:
        print("[LLM] Cannot connect to Ollama. Is it running?")
        return ExtractedInfo()
    except Exception as e:
        print(f"[LLM] Error: {e}")
        return ExtractedInfo()


def parse_llm_output(raw: str) -> ExtractedInfo:
    """
    Safely parse JSON from LLM output.
    Handles common issues like markdown code blocks.
    """
    print(f"[LLM] Raw output: {raw}")
    
    if not raw:
        print("[LLM] Empty response")
        return ExtractedInfo()
    
    # Clean up common issues
    text = raw.strip()
    
    # Remove markdown code blocks if present
    text = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```\s*$', '', text)
    text = re.sub(r'^```\s*', '', text)
    text = text.strip()
    
    print(f"[LLM] Cleaned: {text}")
    
    # Find JSON object in text (handle multiline)
    match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if not match:
        print(f"[LLM] No JSON found")
        return ExtractedInfo()
    
    json_str = match.group(0)
    print(f"[LLM] JSON string: {json_str}")
    
    try:
        data = json.loads(json_str)
        print(f"[LLM] Parsed: {data}")
        return ExtractedInfo(
            name=data.get("name") if data.get("name") else None,
            relation=data.get("relation") if data.get("relation") else None,
            context=data.get("context") if data.get("context") else None,
        )
    except json.JSONDecodeError as e:
        print(f"[LLM] JSON parse error: {e}")
        return ExtractedInfo()


async def extract_info_async(sentence: str) -> ExtractedInfo:
    """Async version of extract_info."""
    if not sentence or not sentence.strip():
        return ExtractedInfo()
    
    prompt = f'{SYSTEM_PROMPT}"{sentence.strip()}"'
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 100,
                    }
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                print(f"[LLM] Ollama error: {response.status_code}")
                return ExtractedInfo()
            
            result = response.json()
            raw_output = result.get("response", "")
            return parse_llm_output(raw_output)
            
    except httpx.ConnectError:
        print("[LLM] Cannot connect to Ollama. Is it running?")
        return ExtractedInfo()
    except Exception as e:
        print(f"[LLM] Error: {e}")
        return ExtractedInfo()
