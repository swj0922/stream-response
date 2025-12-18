import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN'; // 引入中文语言包

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ConfigProvider locale={zhCN}>
    <App />
  </ConfigProvider>
);
