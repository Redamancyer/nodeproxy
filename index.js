const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');
const { URL } = require('url');

const app = express();
const port = 3000;

// 中间件配置
app.use(cors()); // 启用CORS支持
app.use(express.json()); // 解析JSON请求体
app.use(express.urlencoded({ extended: true })); // 解析URL编码请求体

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// 代理路由 - 修复后的版本
app.get('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url+'&type=1&offset=0&total=true&limit=1';
    console.log(targetUrl+'------')
    
    if (!targetUrl) {
      return res.status(400).json({ 
        error: '缺少URL参数',
        usage: '/proxy?url=目标网址'
      });
    }
    
    console.log(`代理请求: ${targetUrl}`);
    
    // 验证URL格式
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (error) {
      return res.status(400).json({ 
        error: 'URL格式无效',
        details: error.message 
      });
    }
    
    // 选择协议模块
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    console.log(parsedUrl)
    
    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    };
  
  // 准备请求选项
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      ...browserHeaders,
      'Host': parsedUrl.hostname,
      'Referer': `${parsedUrl.protocol}//${parsedUrl.hostname}`
    }
  };
    
    // 发起请求
    const proxyReq = protocol.request(options, (proxyRes) => {
      let data = '';
      
      // 收集数据
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });
      
      // 请求完成
      proxyRes.on('end', () => {
        // 设置响应头
        res.set({
          'Content-Type': proxyRes.headers['content-type'] || 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        
        // 发送响应
        res.status(proxyRes.statusCode || 200).send(data);
        console.log(`请求成功: ${proxyRes.statusCode}`);
      });
    }).on('error', (err) => {
      console.error('代理错误:', err.message);
      res.status(500).json({ 
        error: '代理请求失败', 
        details: err.message 
      });
    });
    
    // 设置超时
    proxyReq.setTimeout(10000, () => {
      console.error('请求超时');
      proxyReq.destroy();
      res.status(504).json({ error: '请求超时' });
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('服务器错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误', 
      details: error.message 
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'HTTP Proxy Server'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: 'HTTP代理服务器已就绪',
    endpoints: {
      'GET /proxy': '代理GET请求，参数: url=目标网址',
      'GET /health': '健康检查'
    },
    example: '/proxy?url=https://jsonplaceholder.typicode.com/posts/1'
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`HTTP代理服务器运行在 http://localhost:${port}`);
  console.log(`使用示例: http://localhost:${port}/proxy?url=https://jsonplaceholder.typicode.com/posts/1`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  process.exit(0);
});