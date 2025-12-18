import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

function App() {
  // 状态管理：对话列表、输入值、加载状态、会话ID
  const [conversations, setConversations] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4()); // 生成唯一的会话ID
  const chatListRef = useRef(null); // 用于滚动到底部的ref

  // 初始化时获取聊天历史（这里因为是前端首次加载，历史为空，仅做示例）
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/chat/history?session_id=${sessionId}`);
        const history = await response.json();
        setConversations(history);
      } catch (error) {
        console.error('获取聊天历史失败：', error);
      }
    };
    fetchHistory();
  }, [sessionId]);

  // 自动滚动到最新消息
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [conversations]);

  // 发送问题的处理函数
  const handleSendQuestion = async () => {
    if (!inputValue.trim() || loading) return;

    // 1. 将用户的问题添加到对话列表
    const userMessage = { role: 'user', content: inputValue.trim() };
    setConversations(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // 2. 创建一个临时的助手消息（用于流式更新）
      let assistantMessage = { role: 'assistant', content: '' };
      setConversations(prev => [...prev, assistantMessage]);

      // 3. 调用后端SSE接口，接收流式数据
      const eventSource = new EventSource(
        `http://localhost:8000/api/chat/stream?session_id=${sessionId}&question=${encodeURIComponent(userMessage.content)}`
      );

      // 4. 处理流式数据
      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          // 流式结束，关闭EventSource
          eventSource.close();
          setLoading(false);
          return;
        }
        // 逐字更新助手的回复内容
        setConversations(prev => {
          const newConversations = [...prev];
          const lastIndex = newConversations.length - 1;
          newConversations[lastIndex] = {
            ...newConversations[lastIndex],
            content: newConversations[lastIndex].content + event.data
          };
          return newConversations;
        });
      };

      // 5. 处理错误
      eventSource.onerror = (error) => {
        console.error('SSE连接错误：', error);
        eventSource.close();
        setLoading(false);
        // 更新助手消息为错误提示
        setConversations(prev => {
          const newConversations = [...prev];
          const lastIndex = newConversations.length - 1;
          newConversations[lastIndex] = {
            ...newConversations[lastIndex],
            content: '抱歉，获取回复失败，请重试！'
          };
          return newConversations;
        });
      };
    } catch (error) {
      console.error('发送问题失败：', error);
      setLoading(false);
      // 回滚对话列表（移除临时的助手消息）
      setConversations(prev => prev.slice(0, -1));
    }
  };

  return (
    <div className="app-container">
      <h1 style={{ textAlign: 'center', marginBottom: 20 }}>大模型流式问答网站</h1>
      {/* 对话列表区域 */}
      <div className="chat-list" ref={chatListRef}>
        {conversations.map((item, index) => (
          <div key={index} className={`message-item ${item.role}`}>
            {item.role === 'assistant' ? (
              <Avatar icon={<RobotOutlined />} style={{ marginRight: 8 }} />
            ) : (
              <Avatar icon={<UserOutlined />} style={{ marginLeft: 8, order: 1 }} />
            )}
            <div className="message-content">{item.content}</div>
          </div>
        ))}
      </div>
      {/* 输入框区域 */}
      <div className="input-area">
        <Input
          placeholder="请输入你的问题..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={handleSendQuestion}
          disabled={loading}
        />
        <Button type="primary" onClick={handleSendQuestion} loading={loading}>
          发送
        </Button>
      </div>
    </div>
  );
}

export default App;