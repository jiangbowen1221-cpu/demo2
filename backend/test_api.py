import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

try:
    print("Testing Aliyun DashScope connection...")
    # 使用用户指定的 glm-4.7 模型
    model_to_use = "glm-4.7"
    print(f"Testing with model: {model_to_use}")

    response = client.chat.completions.create(
        model=model_to_use,
        messages=[
            {"role": "user", "content": "你好，请确认你是否已准备就绪。"}
        ]
    )
    print(f"Response: {response.choices[0].message.content}")
    print("\nAPI Connection Successful! 系统已跑通。")
except Exception as e:
    print(f"Error: {e}")
