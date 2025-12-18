from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
import asyncio
import uuid
from typing import Dict, List
from fastapi.middleware.cors import CORSMiddleware

# 初始化FastAPI应用
app = FastAPI(title="LLM流式对话后端", version="1.0")

# 配置CORS中间件，允许前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 允许的前端地址（React默认端口）
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法（GET、POST等）
    allow_headers=["*"],  # 允许所有请求头
)

# 内存存储对话上下文：key=会话ID，value=对话列表（每个元素是{role: user/assistant, content: 内容}）
conversation_store: Dict[str, List[Dict[str, str]]] = {}

# 模拟大模型的硬编码回复（可根据问题简单适配，这里做示例）
def get_hardcode_response(question: str) -> str:
    """根据用户问题返回硬编码的回复内容"""
    if "你好" in question:
        return "你好呀！😊 很高兴能为你解答问题，无论你有什么疑问，我都会尽力为你提供帮助。"
    elif "多轮对话" in question:
        return "多轮对话的核心是保留上下文哦！比如你现在问了这个问题，接下来可以继续追问相关内容，我会记得我们之前的对话。"
    elif "流式输出" in question:
        return "流式输出就是把回复内容逐字、逐句地返回给前端，而不是一次性返回所有内容，这样能提升用户的交互体验。"
    else:
        return f"你问的问题是：「{question}」。这是一个模拟的流式回复，我会逐字展示这段内容，以此来演示流式输出的效果。"

async def generate_stream_content(content: str):
    """将文本内容分批次生成，模拟流式输出（每50毫秒返回一个字符）"""
    for char in content:
        yield f"data: {char}\n\n"  # SSE的标准格式：data: 内容\n\n
        await asyncio.sleep(0.05)  # 控制流式输出的速度，单位秒
    # 发送结束标志
    yield "data: [DONE]\n\n"

@app.get("/api/chat/stream")
async def chat_stream(
    session_id: str = Query(..., description="用户会话ID，用于区分不同对话"),
    question: str = Query(..., description="用户的问题")
):
    """处理流式对话请求的接口"""
    # 1. 初始化或获取当前会话的上下文
    if session_id not in conversation_store:
        conversation_store[session_id] = []
    conversation = conversation_store[session_id]

    # 2. 将用户的问题添加到上下文
    conversation.append({"role": "user", "content": question})

    # 3. 获取硬编码的回复内容
    response_content = get_hardcode_response(question)

    # 4. 流式返回回复内容（同时后续会把完整回复添加到上下文）
    async def stream_response():
        full_response = ""
        async for chunk in generate_stream_content(response_content):
            full_response += chunk.replace("data: ", "").replace("\n\n", "")  # 拼接完整回复
            yield chunk
        # 5. 流式结束后，将完整回复添加到上下文
        conversation.append({"role": "assistant", "content": full_response.replace("[DONE]", "")})

    return StreamingResponse(stream_response(), media_type="text/event-stream")

@app.get("/api/chat/history")
async def get_chat_history(session_id: str = Query(..., description="用户会话ID")):
    """获取指定会话的聊天历史"""
    return conversation_store.get(session_id, [])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)