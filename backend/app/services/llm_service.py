from openai import AsyncOpenAI
from app.core.config import settings
from typing import List, Dict, AsyncGenerator

class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL
        )

    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        model: str = None,
        temperature: float = 0.7
    ) -> str:
        """Standard Chat Completion"""
        if not model:
            model = settings.DEFAULT_MODEL
            
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"LLM Error: {e}")
            return f"Error generating response: {str(e)}"

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """Streaming Chat Completion"""
        if not model:
            model = settings.DEFAULT_MODEL
            
        try:
            # 数据清洗：确保没有空消息，且格式正确
            valid_messages = []
            for m in messages:
                if m.get("content") and m.get("role"):
                    valid_messages.append({
                        "role": m["role"],
                        "content": str(m["content"]).strip()
                    })
            
            if not valid_messages:
                yield "Error: No valid messages to send to LLM."
                return

            # 兼容性处理：某些模型（如 Claude）在某些 Provider 下要求首条消息必须是 user，或者不能只有 system 消息
            # 如果第一条是 system，且只有这一条，我们把它改成 user 或者在后面加一条 user
            if len(valid_messages) == 1 and valid_messages[0]["role"] == "system":
                # 将单条 system 消息转为 user 消息，提高兼容性
                valid_messages[0]["role"] = "user"
            elif valid_messages[0]["role"] == "system" and len(valid_messages) > 1 and valid_messages[1]["role"] == "system":
                # 合并连续的 system 消息
                system_content = valid_messages[0]["content"] + "\n\n" + valid_messages[1]["content"]
                valid_messages[1]["content"] = system_content
                valid_messages.pop(0)

            print(f"DEBUG: Starting stream for model {model}")
            print(f"DEBUG: Messages structure: {[ {'role': m['role'], 'len': len(m['content'])} for m in valid_messages ]}")
            
            stream = await self.client.chat.completions.create(
                model=model,
                messages=valid_messages,
                temperature=temperature,
                stream=True,
                # 增加超时时间，防止长文本生成中断
                timeout=120.0 
            )
            
            async for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if hasattr(delta, 'content') and delta.content:
                            content = delta.content
                            # print(content, end="", flush=True) # 调试：逐字打印到终端
                            yield content
        except Exception as e:
            print(f"DEBUG: LLM Stream Error: {e}")
            import traceback
            traceback.print_exc()
            yield f"Error generating response: {str(e)}"

llm_service = LLMService()
