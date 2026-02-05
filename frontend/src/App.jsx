import React, { useState, useEffect, useRef } from 'react';
import { 
  Layout, Typography, Input, Button, Card, Tabs, List, Space, Tag, Divider, Avatar, message, Modal, Upload, Form, Checkbox, Menu, Spin, Dropdown, Tooltip, Table, InputNumber, DatePicker, Drawer, Empty
} from 'antd';
import { 
  PlusOutlined, HistoryOutlined, SendOutlined, StopOutlined,
  RobotOutlined, UserOutlined, FileTextOutlined, 
  CodeOutlined, DesktopOutlined, AppstoreOutlined,
  FullscreenOutlined, FullscreenExitOutlined,
  UploadOutlined, PaperClipOutlined, LockOutlined,
  LogoutOutlined, DeleteOutlined, FileMarkdownOutlined, RocketOutlined, SettingOutlined, PictureOutlined, CrownOutlined, BarChartOutlined, KeyOutlined,
  SelectOutlined, CloseOutlined, AimOutlined, DownloadOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const { Header, Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// --- Helper: Streaming Fetch ---
const fetchStream = async (url, body, onChunk, onDone, onError, signal) => {
    const token = localStorage.getItem('token');
    if (!token) {
        const err = new Error('未登录或登录已过期，请重新登录');
        onError?.(err);
        throw err;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal,
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('is_admin');
        const err = new Error('登录会话已过期，请重新登录');
        onError?.(err);
        window.location.reload();
        return;
      }

      if (response.status === 402) {
        const errorData = await response.json();
        message.error(errorData.detail || '授权无效');
        onError?.(new Error(errorData.detail));
        return;
      }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullText = '';
    let displayedText = '';
    let isStreamDone = false;
    let isAborted = false;

    // 监听信号取消
    if (signal) {
      signal.addEventListener('abort', () => {
        isAborted = true;
      });
    }

    // 打字机效果：平滑同步 fullText 到 displayedText
    const updateDisplay = () => {
      if (isAborted) return;

      if (displayedText.length < fullText.length) {
        // 追赶机制：如果积压太多，加速显示
        const diff = fullText.length - displayedText.length;
        // 如果积压超过 200 字，一次显示 10% 的积压内容；如果超过 50 字，一次显示 5 字；否则逐字显示
        const step = diff > 200 ? Math.ceil(diff / 10) : (diff > 50 ? 5 : 1);
        
        displayedText += fullText.substring(displayedText.length, displayedText.length + step);
        onChunk(displayedText);
        
        // 动态调整延迟：积压越多，更新越快
        const delay = diff > 100 ? 5 : 15; 
        setTimeout(updateDisplay, delay);
      } else if (!isStreamDone) {
        // 赶上了，等待流的新内容
        setTimeout(updateDisplay, 30);
      } else {
        // 流结束且全部内容已显示
        onChunk(fullText);
        if (onDone) onDone(fullText);
      }
    };

    // 启动打字机循环
    updateDisplay();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        isStreamDone = true;
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error("Stream error:", error);
    if (onError) onError(error);
    throw error;
  }
};

const SingleEditor = ({ content, setContent, title, onSave }) => {
    // 默认开启预览模式，除非内容为空
    const [isPreview, setIsPreview] = useState(!!content);
    
    // 当内容从无到有变化时（例如刚生成完），自动切换到预览
    useEffect(() => {
        // Only auto-switch to preview if content exists AND we haven't manually set preview mode yet (initial load)
        // Or if content just appeared from empty state
        if (content && !isPreview && !title.includes('PRD')) { 
             // 暂时不对 PRD 强制切换，防止编辑丢失。或者更稳妥的方式是完全移除这个自动切换逻辑，交给用户控制。
             // 这里选择移除自动切换逻辑，除了新生成内容的情况，但如何判断新生成比较复杂。
             // 简单起见，注释掉自动切换，防止切 Tab 导致状态重置。
             // setIsPreview(true); 
        }
    }, [content]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1D1F21' }}>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #3B4E53', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1D1F21' }}>
              <Title level={5} style={{ margin: 0, color: '#fff' }}>{title}</Title>
              <Space>
                  <Button 
                      type={isPreview ? 'default' : 'primary'}
                      size="small"
                      onClick={() => setIsPreview(!isPreview)}
                      icon={isPreview ? <FileTextOutlined /> : <FileMarkdownOutlined />}
                      style={{ 
                          background: isPreview ? 'transparent' : '#0FB698', 
                          borderColor: isPreview ? '#3B4E53' : '#0FB698', 
                          color: isPreview ? 'rgba(255,255,255,0.65)' : '#fff' 
                      }}
                  >
                      {isPreview ? '编辑内容' : '查看文档'}
                  </Button>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                      {isPreview ? '当前为阅读模式' : '当前为编辑模式，内容将自动保存'}
                  </Text>
              </Space>
          </div>
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#1D1F21' }}>
              {isPreview ? (
                  <div className="markdown-preview" style={{ 
                      color: '#e0e0e0', 
                      lineHeight: '1.8',
                      maxWidth: '900px',
                      margin: '0 auto',
                      padding: '20px',
                      background: '#2b2d31',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}>
                      <ReactMarkdown
                        components={{
                            h1: ({node, ...props}) => <h1 style={{ color: '#fff', borderBottom: '1px solid #3B4E53', paddingBottom: '10px', marginTop: '24px' }} {...props} />,
                            h2: ({node, ...props}) => <h2 style={{ color: '#0FB698', marginTop: '20px' }} {...props} />,
                            h3: ({node, ...props}) => <h3 style={{ color: '#fff', marginTop: '16px' }} {...props} />,
                            p: ({node, ...props}) => <p style={{ marginBottom: '16px', fontSize: '15px' }} {...props} />,
                            ul: ({node, ...props}) => <ul style={{ paddingLeft: '24px', marginBottom: '16px' }} {...props} />,
                            li: ({node, ...props}) => <li style={{ marginBottom: '8px' }} {...props} />,
                            code: ({node, inline, className, children, ...props}) => {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline ? (
                                    <div style={{ background: '#111315', padding: '12px', borderRadius: '6px', margin: '12px 0', border: '1px solid #3B4E53', overflowX: 'auto' }}>
                                        <code className={className} style={{ fontFamily: 'monospace', fontSize: '14px' }} {...props}>
                                            {children}
                                        </code>
                                    </div>
                                ) : (
                                    <code className={className} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }} {...props}>
                                        {children}
                                    </code>
                                )
                            },
                            table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', border: '1px solid #3B4E53', fontSize: '14px' }} {...props} />,
                            th: ({node, ...props}) => <th style={{ background: '#3B4E53', padding: '12px', border: '1px solid #4a5f65', color: '#fff', textAlign: 'left', fontWeight: '600' }} {...props} />,
                            td: ({node, ...props}) => <td style={{ padding: '12px', border: '1px solid #3B4E53', color: '#e0e0e0', verticalAlign: 'top' }} {...props} />,
                            blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '4px solid #0FB698', paddingLeft: '16px', margin: '16px 0', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', background: 'rgba(15,182,152,0.05)', padding: '12px 16px', borderRadius: '0 4px 4px 0' }} {...props} />,
                        }}
                      >
                          {content || '*暂无内容，请点击右上角切换到编辑模式输入，或通过左侧对话生成。*'}
                      </ReactMarkdown>
                  </div>
              ) : (
                  <TextArea 
                      value={content} 
                      onChange={e => setContent(e.target.value)} 
                      placeholder={`在此输入或生成 ${title}...`}
                      autoSize={false}
                      style={{ 
                          width: '100%',
                          height: '100%',
                          border: 'none', 
                          resize: 'none', 
                          fontSize: '15px', 
                          lineHeight: '1.8',
                          padding: '0',
                          boxShadow: 'none',
                          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          color: '#fff',
                          background: '#1D1F21'
                      }}
                      onBlur={onSave}
                  />
              )}
          </div>
      </div>
    );
};

const App = () => {
  const [isPublicPreview, setIsPublicPreview] = useState(window.location.pathname.startsWith('/preview/'));
  const [publicData, setPublicData] = useState(null);

  useEffect(() => {
    if (isPublicPreview) {
      const token = window.location.pathname.split('/').pop();
      axios.get(`/api/v1/generation/public/preview/${token}`)
        .then(res => setPublicData(res.data))
        .catch(() => message.error('预览链接无效或已过期'));
    }
  }, [isPublicPreview]);

  if (isPublicPreview) {
    if (!publicData) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" tip="正在加载预览..." /></div>;
    const injection = `<script>window.PROJECT_ID = ${publicData.project_id};</script>`;
    return (
      <iframe 
        srcDoc={injection + publicData.demo_code} 
        style={{ width: '100vw', height: '100vh', border: 'none' }}
        title={publicData.name}
      />
    );
  }
  // --- State ---
  const [loginForm] = Form.useForm();
  const [adminForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('requirements'); // requirements, product, tech, demo, report
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem('is_admin') === 'true');
  const [showAdmin, setShowAdmin] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedElements, setSelectedElements] = useState([]);
  const [isSelectionConfirmed, setIsSelectionConfirmed] = useState(false); // 新增：是否已确认将选择添加到上下文
  const [reportContent, setReportContent] = useState('');
  const previewContainerRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'ELEMENT_SELECTED') {
        // 如果有 traceId，则立刻尝试在左侧编辑器中定位
        if (event.data.traceId) {
          // 延迟一点点执行，确保 UI 状态更新
          setTimeout(() => scrollToCode(event.data.traceId), 100);
        }

        setSelectedElements(prev => {
          // 优先使用 traceId 匹配，没有则回退到 selector
          const identifier = event.data.traceId || event.data.selector;
          const exists = prev.find(el => (el.traceId && el.traceId === event.data.traceId) || el.selector === event.data.selector);
          
          if (exists) {
            return prev.filter(el => !((el.traceId && el.traceId === event.data.traceId) || el.selector === event.data.selector));
          }
          
          return [...prev, { 
            traceId: event.data.traceId, 
            selector: event.data.selector, 
            html: event.data.html 
          }];
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ 
          type: 'SET_SELECTION_MODE', 
          enabled: isSelectionMode 
        }, '*');
        if (!isSelectionMode) {
          // 退出选择模式时，如果没有确认，则清空
          if (!isSelectionConfirmed) {
            setSelectedElements([]);
          }
        } else {
          // 进入选择模式时，清除之前的确认状态
          setIsSelectionConfirmed(false);
        }
      }
  }, [isSelectionMode]);

  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        const targetWidth = 1280; // 以 1280px 为标准宽度
        const scale = containerWidth / targetWidth;
        setPreviewScale(scale);
      }
    };

    const resizeObserver = new ResizeObserver(updateScale);
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }
    
    updateScale();
    return () => resizeObserver.disconnect();
  }, [activeTab]);

  const handlePublish = async () => {
    if (!currentProjectId) return;
    try {
      const res = await axios.post(`/api/v1/generation/projects/${currentProjectId}/publish`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const fullUrl = `${window.location.origin}/preview/${res.data.share_token}`;
      setShareUrl(fullUrl);
      setShowShareModal(true);
    } catch (e) {
      message.error('发布失败');
    }
  };

  const injectProjectId = (code, type = 'demo') => {
    if (!code) return '';
    
    const selectionScript = `
      <script>
        (function() {
          // --- 全局防跳转逻辑 ---
          // 拦截所有点击，防止任何形式的外部跳转或页面刷新
          document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
              const href = link.getAttribute('href');
              
              // 判定逻辑：只要不是明确的外部 http(s) 链接，或者只要是可能导致当前窗口跳转的链接，一律拦截
              const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
              const isJavascriptVoid = href && href.includes('javascript:void');
              
              if (!isJavascriptVoid) {
                // 如果是 # 或空，或者本地路径，或者 index.html 等
                if (!href || href === '#' || href === '' || href.startsWith('/') || !isExternal) {
                  e.preventDefault();
                  console.log('【防跳转】拦截了链接点击:', href);
                  return false;
                }
              }
            }
          }, true);

          // 拦截表单提交
          document.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('【防跳转】拦截了表单提交');
          }, true);

          ${type === 'demo' ? `
          let isSelectionMode = false;
          let hoveredElement = null;

          // 样式注入：用于高亮显示
          const style = document.createElement('style');
          style.innerHTML = \`
            [data-selection-hover="true"] {
              outline: 2px dashed #0FB698 !important;
              outline-offset: -2px !important;
              cursor: crosshair !important;
              transition: outline 0.1s ease !important;
            }
            [data-selected="true"] {
              outline: 2px solid #00ECC8 !important;
              outline-offset: -2px !important;
              background-color: rgba(15, 182, 152, 0.1) !important;
            }
          \`;
          document.head.appendChild(style);

          window.addEventListener('message', (e) => {
            if (e.data.type === 'SET_SELECTION_MODE') {
              isSelectionMode = e.data.enabled;
              if (!isSelectionMode) {
                clearHover();
                document.querySelectorAll('[data-selected="true"]').forEach(el => {
                  el.removeAttribute('data-selected');
                });
              }
            }
          });

          const clearHover = () => {
            document.querySelectorAll('[data-selection-hover="true"]').forEach(el => {
              el.removeAttribute('data-selection-hover');
            });
            hoveredElement = null;
          };

          document.addEventListener('mouseover', (e) => {
            if (!isSelectionMode) return;
            e.stopPropagation();
            clearHover();
            hoveredElement = e.target;
            if (hoveredElement.getAttribute('data-selected') !== 'true') {
              hoveredElement.setAttribute('data-selection-hover', 'true');
            }
          }, true);

          // 拦截所有可能的交互事件
          const preventInteraction = (e) => {
            if (!isSelectionMode) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          };

          ['mousedown', 'mouseup', 'click', 'dblclick', 'submit', 'focus'].forEach(eventType => {
             document.addEventListener(eventType, (e) => {
                if (!isSelectionMode) return;
                
                // 只有 click 事件需要执行选择逻辑，其他事件纯粹为了拦截交互
                if (eventType === 'click') {
                    preventInteraction(e);
                    
                    // 向上寻找最近的带有 data-trace-id 的元素
                    let el = e.target;
                    let traceId = el.getAttribute('data-trace-id');
                    
                    // 如果当前点击的元素没有 ID，就往父级找，最多找 5 层
                    let depth = 0;
                    while (!traceId && el.parentElement && depth < 5) {
                      el = el.parentElement;
                      traceId = el.getAttribute('data-trace-id');
                      depth++;
                    }
                    
                    const isSelected = el.getAttribute('data-selected') === 'true';
                    
                    if (isSelected) {
                      el.removeAttribute('data-selected');
                    } else {
                      el.setAttribute('data-selected', 'true');
                    }

                    // 获取选择器（备用）
                    const getSelector = (element) => {
                      if (element.id) return '#' + element.id;
                      let path = [];
                      let current = element;
                      while (current && current.nodeType === Node.ELEMENT_NODE) {
                        let selector = current.nodeName.toLowerCase();
                        let index = 1;
                        let sibling = current.previousElementSibling;
                        while (sibling) {
                          if (sibling.nodeName === current.nodeName) index++;
                          sibling = sibling.previousElementSibling;
                        }
                        path.unshift(selector + ":nth-of-type(" + index + ")");
                        current = current.parentElement;
                      }
                      return path.join(" > ");
                    };

                    window.parent.postMessage({
                      type: 'ELEMENT_SELECTED',
                      selector: getSelector(el),
                      traceId: traceId,
                      html: el.outerHTML
                    }, '*');
                } else {
                    // 其他事件直接拦截
                    preventInteraction(e);
                }
             }, true); // 使用捕获阶段，确保最先执行
          });
          ` : ''}
        })();
      </script>
    `;

    const reportPrintStyle = type === 'report' ? `
      <style>
        /* 屏幕显示样式优化 - 强制覆盖所有幻灯片行为 */
        @media screen {
            html, body {
                height: auto !important;
                min-height: 100% !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                background-color: #f0f2f5 !important;
                margin: 0 !important;
                padding: 20px 0 !important;
            }
            
            /* 暴力重置所有常见的容器和页面 */
            .reveal, .slides, .swiper-container, .swiper-wrapper, .slide-page, section, .section, .slide, [class*="slide"] {
                display: block !important;
                position: relative !important;
                height: auto !important;
                min-height: 600px !important;
                width: 90% !important;
                max-width: 1000px !important;
                margin: 0 auto 30px auto !important;
                transform: none !important;
                top: auto !important;
                left: auto !important;
                right: auto !important;
                bottom: auto !important;
                overflow: visible !important;
                opacity: 1 !important;
                visibility: visible !important;
                background: white !important;
                color: black !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                border-radius: 8px !important;
                padding: 40px !important;
                box-sizing: border-box !important;
            }

            /* 隐藏所有导航控制元素 */
            .controls, .navigate-right, .navigate-left, .progress, .swiper-pagination, .swiper-button-next, .swiper-button-prev {
                display: none !important;
            }
            
            /* 确保内容不被裁剪 */
            * {
                max-height: none !important;
            }
        }
        @media print {
            @page {
                size: landscape;
                margin: 0;
            }
            html, body {
                width: 100%;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background-color: white !important;
            }
            /* 强制打印样式与屏幕预览保持一致 */
            .reveal, .slides, .swiper-container, .swiper-wrapper, .slide-page, section, .section, .slide, [class*="slide"] {
                display: block !important;
                position: relative !important;
                width: 100% !important;
                height: auto !important; /* 不再强制 100vh，允许内容自然撑开 */
                min-height: 90vh !important; /* 保持每页的充实感 */
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                
                /* 视觉风格同步 */
                /* background: white !important; 移除强制白色背景，允许自定义背景 */
                /* color: black !important; 移除强制黑色文字 */
                box-shadow: none !important; /* 打印时通常不需要阴影，或者可以保留但要小心边界 */
                border: 1px solid #eee !important; /* 打印时用边框代替阴影 */
                border-radius: 8px !important;
                padding: 40px !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                
                opacity: 1 !important;
                visibility: visible !important;
                transform: none !important;
                left: auto !important;
                top: auto !important;
                overflow: visible !important;
            }
            
            /* 确保文本颜色正常 */
            h1, h2, h3, h4, h5, h6, p, span, div {
                /* color: black !important; 移除强制黑色文字 */
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            /* 隐藏导航和无关元素 */
            button, .nav-controls, .pagination, .swiper-pagination, .swiper-button-next, .swiper-button-prev, .controls {
                display: none !important;
            }
            
            /* 重置滚动容器 */
            .scroll-container, .swiper-wrapper {
                transform: none !important;
                width: auto !important;
                height: auto !important;
                overflow: visible !important;
                display: block !important;
            }
            
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                max-height: none !important;
            }
        }
      </style>
    ` : '';

    const configScript = type === 'demo' ? `<script>window.PROJECT_ID = ${currentProjectId};</script>` : '';
    
    // 注入逻辑：尝试在 </body> 前注入，如果没有 body 则加在最后
    if (code.includes('</body>')) {
      return code.replace('</body>', `${configScript}${reportPrintStyle}${selectionScript}</body>`);
    } else if (code.includes('</html>')) {
      return code.replace('</html>', `${configScript}${reportPrintStyle}${selectionScript}</html>`);
    } else {
      // 没有任何结束标记，直接追加
      return code + configScript + reportPrintStyle + selectionScript;
    }
  };
  const fetchLicenses = async () => {
    setLicenseLoading(true);
    try {
      const res = await axios.get('/api/v1/admin/list', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLicenses(res.data);
    } catch (e) {
      message.error('获取授权列表失败');
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleGenerateLicense = async (values) => {
    setLicenseLoading(true);
    try {
      await axios.post('/api/v1/admin/generate', {
        username: values.username,
        max_calls: values.max_calls,
        valid_days: values.valid_days
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      message.success('授权码生成成功');
      adminForm.resetFields();
      fetchLicenses();
    } catch (e) {
      message.error('生成失败: ' + (e.response?.data?.detail || '未知错误'));
    } finally {
      setLicenseLoading(false);
    }
  };
  const [showLogin, setShowLogin] = useState(false);
  const abortControllerRef = useRef(null);
  
  // Project Data
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectName, setProjectName] = useState('New Project');

  // Artifacts Content
  const [requirementsDoc, setRequirementsDoc] = useState('');
  const [productDoc, setProductDoc] = useState('');
  const [techDoc, setTechDoc] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [demoPreviewCode, setDemoPreviewCode] = useState(''); // 新增：专门用于预览的代码
  const [isDemoLoading, setIsDemoLoading] = useState(false); // 新增：专门用于原型生成的 loading
  const editorRef = useRef(null);
  const demoCodeRef = useRef('');

  useEffect(() => {
    demoCodeRef.current = demoCode;
  }, [demoCode]);

  /**
   * 自动滚动代码编辑器到指定的元素位置并实现亮黄色高亮
   * @param {string} traceId 元素的追踪ID
   */
  const scrollToCode = (traceId) => {
    if (!traceId || !editorRef.current) return;
    
    const code = demoCodeRef.current;
    const patterns = [
      `data-trace-id="${traceId}"`,
      `data-trace-id='${traceId}'`,
      `data-trace-id=${traceId}`
    ];
    
    let index = -1;
    for (const p of patterns) {
      index = code.indexOf(p);
      if (index !== -1) break;
    }
    
    if (index !== -1) {
      let start = code.lastIndexOf('<', index);
      let end = code.indexOf('>', index) + 1;
      
      if (start === -1) start = index;
      if (end === 0) end = index + 10;

      const textarea = editorRef.current.resizableTextArea.textArea;
      
      // 强制切换 Tab 到原型展示，确保编辑器可见
      setActiveTab('demo');

      // 延迟执行以确保 Tab 切换完成
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, end);
        
        const textBefore = code.substring(0, start);
        const linesBefore = textBefore.split('\n').length;
        const lineHeight = 23.4; // 13px * 1.8 (根据 renderDemoPreview 的设置)
        const visibleLines = Math.floor(textarea.clientHeight / lineHeight);
        const scrollPos = (linesBefore - Math.floor(visibleLines / 2)) * lineHeight;
        
        textarea.scrollTo({
          top: Math.max(0, scrollPos),
          behavior: 'smooth'
        });

        // 增加一个短暂的边框闪烁效果，增强视觉反馈
        textarea.style.transition = 'box-shadow 0.3s';
        textarea.style.boxShadow = '0 0 15px #ffff00';
        setTimeout(() => {
          textarea.style.boxShadow = 'none';
        }, 1000);
      }, 50);
    }
  };

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是你的智能开发助手。请告诉我你想做什么？' }
  ]);
  const messagesEndRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 当项目切换时，终止正在进行的生成任务
  useEffect(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    // 重置加载状态，避免UI卡在loading
    setLoading(false);
    setIsDemoLoading(false);
  }, [currentProjectId]);

  // --- API Wrappers ---
  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', values.username);
      params.append('password', values.password);
      
      const res = await axios.post('/api/v1/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('is_admin', res.data.is_admin ? 'true' : 'false');
      setIsLoggedIn(true);
      setUsername(res.data.username);
      setIsAdmin(res.data.is_admin);
      message.success('登录成功');
      setShowLogin(false);
      fetchProjects(); // Refresh projects for this user
    } catch (e) {
      message.error('登录失败: ' + (e.response?.data?.detail || '用户名或密码错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      const values = await loginForm.validateFields();
      setLoading(true);
      const res = await axios.post('/api/v1/auth/register', { 
        username: values.username, 
        password: values.password 
      });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('is_admin', 'false');
      setIsLoggedIn(true);
      setUsername(res.data.username);
      setIsAdmin(false);
      message.success('注册成功并已自动登录');
      setShowLogin(false);
      fetchProjects();
    } catch (e) {
      if (e.errorFields) return; // Validation failed
      message.error('注册失败: ' + (e.response?.data?.detail || '用户名可能已存在'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_admin');
    setIsLoggedIn(false);
    setUsername('');
    setIsAdmin(false);
    setCurrentProjectId(null);
    setProjects([]);
    createNewProject();
    message.success('已退出登录');
  };

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const res = await axios.get('/api/v1/generation/projects/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProjects(res.data);
    } catch (e) {
      // 只有在非 401 错误时才打印日志，避免未登录时的干扰
      if (e.response?.status !== 401) {
        console.error("Failed to fetch projects", e);
      }
      
      if (e.response?.status === 401) {
        // Token 失效，静默退出登录
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('is_admin');
        setIsLoggedIn(false);
        setUsername('');
        setIsAdmin(false);
      }
    }
  };

  const saveProject = async (stepKey, content, chatHistory = null) => {
    const token = localStorage.getItem('token');
    if (!token) {
        if (!chatHistory) message.warning('请先登录以保存项目'); // Only warn if explicit save
        return;
    }

    const data = {};
    if (stepKey === 'requirements') data.requirements_doc = content;
    if (stepKey === 'product') data.product_doc = content;
    if (stepKey === 'tech') data.tech_doc = content;
    if (stepKey === 'demo') data.demo_code = content;
    if (stepKey === 'report') data.report_content = content;
    if (chatHistory) data.chat_history = JSON.stringify(chatHistory);
    
    if (stepKey === 'requirements' && !currentProjectId) {
         data.name = content.substring(0, 20).trim() || '新项目';
    }

    try {
      if (currentProjectId) {
        await axios.patch(`/api/v1/generation/projects/${currentProjectId}`, data, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
      } else if (stepKey) { // Only create new project if saving content, not just chat
        const res = await axios.post('/api/v1/generation/projects/', {
          name: data.name || '新项目', 
          ...data
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setCurrentProjectId(res.data.id);
        setProjectName(res.data.name);
        fetchProjects();
      }
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const loadProject = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`/api/v1/generation/projects/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const p = res.data;
      setCurrentProjectId(p.id);
      setProjectName(p.name);
      setRequirementsDoc(p.requirements_doc || '');
      setProductDoc(p.product_doc || '');
      setTechDoc(p.tech_doc || '');
      setDemoCode(p.demo_code || '');
      setDemoPreviewCode(p.demo_code || ''); // 初始化预览代码
      setReportContent(p.report_content || '');
      
      // Reset Chat or Load History
      if (p.chat_history && p.chat_history !== "[]") {
          try {
              setMessages(JSON.parse(p.chat_history));
          } catch (e) {
              console.error("Failed to parse chat history", e);
              setMessages([{ role: 'assistant', content: `已加载项目: ${p.name}。我们可以继续完善它。` }]);
          }
      } else {
          setMessages([
            { role: 'assistant', content: `已加载项目: ${p.name}。我们可以继续完善它。` }
          ]);
      }
      
      // Reset selection state when loading a project
      setIsSelectionMode(false);
      setIsSelectionConfirmed(false);
      setSelectedElements([]);

      // Determine tab
      if (p.report_content) setActiveTab('report');
      else if (p.demo_code) setActiveTab('demo');
      else if (p.tech_doc) setActiveTab('tech');
      else if (p.product_doc) setActiveTab('product');
      else setActiveTab('requirements');
      
      message.success('项目加载成功');
    } catch (e) {
      message.error('加载失败');
    }
  };

  const createNewProject = () => {
    setCurrentProjectId(null);
    setProjectName('New Project');
    setRequirementsDoc('');
    setProductDoc('');
    setTechDoc('');
    setDemoCode('');
    setDemoPreviewCode('');
    if (abortControllerRef.current) abortControllerRef.current.abort();
    
    setReportContent('');
    setActiveTab('requirements');
    setMessages([{ role: 'assistant', content: '新项目已创建。请告诉我你的想法！' }]);
    
    // Reset selection state when creating a new project
    setIsSelectionMode(false);
    setIsSelectionConfirmed(false);
    setSelectedElements([]);
  };

  const deleteProject = async (id, e) => {
    if (e) e.stopPropagation(); // 阻止触发加载项目
    Modal.confirm({
      title: '确定要删除这个项目吗？',
      content: '删除后数据将无法恢复。',
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`/api/v1/generation/projects/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          message.success('项目已删除');
          fetchProjects(); // 刷新列表
          if (currentProjectId === id) {
            createNewProject(); // 如果删除的是当前项目，则新建一个
          }
        } catch (e) {
          message.error('删除项目失败');
        }
      }
    });
  };

  // --- Core Logic: Chat Driven Generation ---

  const extractHtml = (content) => {
    if (!content) return '';
    let code = content;
    
    // 1. 尝试匹配标准的 Markdown 代码块
    // 匹配 ```html ... ``` 或 ``` ... ```，不区分大小写
    const htmlBlockRegex = /```(?:html|xml)?\s*([\s\S]*?)```/i;
    const match = code.match(htmlBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // 2. 如果没有代码块，尝试寻找 HTML 标签特征
    // 寻找 <!DOCTYPE html> 或 <html> ... </html>
    const docTypeIndex = code.indexOf('<!DOCTYPE html>');
    const htmlTagIndex = code.indexOf('<html');
    
    if (docTypeIndex !== -1) {
      return code.substring(docTypeIndex).trim();
    }
    
    if (htmlTagIndex !== -1) {
      return code.substring(htmlTagIndex).trim();
    }

    // 3. 兜底：如果看起来像 HTML (包含常见的标签)，则返回全部
    if (code.includes('</div>') || code.includes('</body>') || code.includes('<script>')) {
        return code.trim();
    }

    return code.trim();
  };

  const generateContent = async (targetTab, feedback = null) => {
    // 检查依赖项
    if (targetTab === 'product' && !requirementsDoc) {
      message.warning('请先生成或输入 PRD 文档');
      setActiveTab('requirements');
      return;
    }
    if (targetTab === 'tech' && !productDoc) {
      message.warning('请先生成或输入 UI 设计文档');
      setActiveTab('product');
      return;
    }
    if (targetTab === 'demo' && !techDoc) {
      message.warning('请先生成或输入开发文档');
      setActiveTab('tech');
      return;
    }
    
    // 生成报告时，如果所有文档都为空，则提醒
    if (targetTab === 'report' && !requirementsDoc && !productDoc && !techDoc && !demoCode) {
      message.warning('项目目前还是空的，请先输入一些需求或生成文档后再生成报告');
      setActiveTab('requirements');
      return;
    }

    setLoading(true);
    
    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (targetTab === 'requirements') {
        setMessages(prev => [...prev, { role: 'assistant', content: feedback ? '正在根据反馈优化 PRD 文档...' : '正在为您生成 PRD 文档...' }]);
        await fetchStream(
          '/api/v1/generation/stream/requirements',
          { raw_requirement: feedback || requirementsDoc, current_content: feedback ? requirementsDoc : null },
          (chunk) => setRequirementsDoc(chunk),
          (final) => {
             saveProject('requirements', final);
             setLoading(false);
             setMessages(prev => [...prev, { role: 'assistant', content: 'PRD 文档已就绪。' }]);
          },
          (err) => {
            message.error('生成 PRD 失败: ' + err.message);
            setLoading(false);
          },
          abortControllerRef.current.signal
        );
      } else if (targetTab === 'product') {
        setMessages(prev => [...prev, { role: 'assistant', content: feedback ? '正在根据反馈优化 UI 设计文档...' : '正在根据 PRD 生成 UI 设计文档...' }]);
        await fetchStream(
          '/api/v1/generation/stream/product',
          { 
              requirements_doc: requirementsDoc,
              feedback: feedback || null,
              current_content: feedback ? productDoc : null
          },
          (chunk) => setProductDoc(chunk),
          (final) => {
             saveProject('product', final);
             setLoading(false);
             setMessages(prev => [...prev, { role: 'assistant', content: 'UI 设计文档已就绪。' }]);
          },
          (err) => {
            message.error('生成 UI 设计失败: ' + err.message);
            setLoading(false);
          },
          abortControllerRef.current.signal
        );
      } else if (targetTab === 'tech') {
        setMessages(prev => [...prev, { role: 'assistant', content: feedback ? '正在根据反馈优化开发文档...' : '正在根据 UI 设计生成开发文档...' }]);
        await fetchStream(
          '/api/v1/generation/stream/technical',
          { 
              product_doc: productDoc,
              feedback: feedback || null,
              current_content: feedback ? techDoc : null
          },
          (chunk) => setTechDoc(chunk),
          (final) => {
             saveProject('tech', final);
             setLoading(false);
             setMessages(prev => [...prev, { role: 'assistant', content: '开发文档已就绪。' }]);
          },
          (err) => {
            message.error('生成开发文档失败: ' + err.message);
            setLoading(false);
          },
          abortControllerRef.current.signal
        );
      } else if (targetTab === 'demo') {
        setMessages(prev => [...prev, { role: 'assistant', content: feedback ? '正在根据反馈修改原型代码...' : '正在根据开发文档生成原型代码...' }]);
        setIsDemoLoading(true); // 开始生成，显示预览区加载动画
        
        if (!demoCode || !feedback) {
             await fetchStream(
              '/api/v1/generation/stream/demo',
              { 
                tech_doc: techDoc,
                requirements_doc: requirementsDoc,
                product_doc: productDoc
              },
              (chunk) => {
                 setDemoCode(extractHtml(chunk));
              },
              (final) => {
                 const code = extractHtml(final);
                 saveProject('demo', code);
                 setDemoPreviewCode(code); // 生成完成后更新预览
                 setIsDemoLoading(false); // 关闭预览区加载动画
                 setLoading(false);
                 setMessages(prev => [...prev, { role: 'assistant', content: '原型已生成，请在右侧预览。' }]);
              },
              (err) => {
                message.error('生成原型失败: ' + err.message);
                setLoading(false);
                setIsDemoLoading(false);
              },
              abortControllerRef.current.signal
            );
        } else {
            await fetchStream(
              '/api/v1/generation/stream/iterate',
              { current_code: demoCode, user_feedback: feedback },
              (chunk) => {
                 setDemoCode(extractHtml(chunk));
              },
              (final) => {
                 const code = extractHtml(final);
                 saveProject('demo', code);
                 setDemoPreviewCode(code); // 生成完成后更新预览
                 setIsDemoLoading(false); // 关闭预览区加载动画
                 setLoading(false);
                 setMessages(prev => [...prev, { role: 'assistant', content: '原型已根据您的意见完成修改。' }]);
              },
              (err) => {
                message.error('迭代原型失败: ' + err.message);
                setLoading(false);
                setIsDemoLoading(false);
              },
              abortControllerRef.current.signal
            );
        }
      } else if (targetTab === 'report') {
        setMessages(prev => [...prev, { role: 'assistant', content: '正在为您整理项目全套文档和原型，生成汇报报告...' }]);
        
        await fetchStream(
          '/api/v1/generation/stream/report',
          { 
            requirements_doc: requirementsDoc,
            product_doc: productDoc,
            tech_doc: techDoc,
            demo_code: demoCode,
            feedback: feedback || null
          },
          (chunk) => {
             setReportContent(extractHtml(chunk));
          },
          (final) => {
             const html = extractHtml(final);
             saveProject('report', html);
             setLoading(false);
             setMessages(prev => [...prev, { role: 'assistant', content: '项目总结报告已生成！您可以查看并导出 PDF 供领导审阅。' }]);
          },
          (err) => {
            message.error('生成报告失败: ' + err.message);
            setLoading(false);
          },
          null,
          abortControllerRef.current.signal
        );
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setLoading(false);
      setIsDemoLoading(false);
      const errMsg = err.message || '未知错误';
      message.error(`生成失败: ${errMsg}`);
      console.error("Generation Error:", err);
    }
  };

  useEffect(() => {
    if (currentProjectId && messages.length > 0) {
        const timer = setTimeout(() => {
            saveProject(null, null, messages);
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [messages, currentProjectId]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setIsDemoLoading(false);
    setMessages(prev => [...prev, { role: 'assistant', content: '🚫 已停止生成。' }]);
    message.info('生成已暂停');
  };

  const handleChatSubmit = async () => {
    if (loading || isDemoLoading) return;
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    
    // Check if we are in partial edit mode (selection mode with selected elements)
    if (activeTab === 'demo' && selectedElements.length > 0 && isSelectionConfirmed) {
      setLoading(true);
      setIsDemoLoading(true); // 开始生成，显示预览区加载动画
      
      // 在对话历史中仅显示用户输入，不再显示冗长的代码块
      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setMessages(prev => [...prev, { role: 'assistant', content: `正在针对选中的 ${selectedElements.length} 个元素进行精准修改...` }]);
      
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      
      try {
        await fetchStream(
          '/api/v1/generation/stream/partial_edit',
          { 
            current_code: demoCode, 
            user_feedback: userMsg,
            selected_elements: selectedElements 
          },
          (chunk) => {
             let code = chunk;
             if (code.includes('```html')) code = code.split('```html')[1].split('```')[0];
             setDemoCode(code);
          },
          (final) => {
             let code = final;
             if (code.includes('```html')) code = code.split('```html')[1].split('```')[0];
             saveProject('demo', code);
             setDemoPreviewCode(code); // 生成完成后更新预览
             setIsDemoLoading(false); // 关闭预览区加载动画
             setLoading(false);
             setIsSelectionMode(false);
             setIsSelectionConfirmed(false);
             setSelectedElements([]);
             setMessages(prev => [...prev, { role: 'assistant', content: '局部修改已完成。' }]);
          },
          null,
          abortControllerRef.current.signal
        );
      } catch (e) {
        setLoading(false);
        setIsDemoLoading(false);
        message.error(`局部修改失败: ${e.message}`);
      }
      return;
    }

    // Determine target tab based on user input (Intent Detection)
    let targetTab = activeTab;
    const lowerMsg = userMsg.toLowerCase();
    
    if (lowerMsg.includes('prd') || lowerMsg.includes('需求') || lowerMsg.includes('requirements')) {
        targetTab = 'requirements';
    } else if (lowerMsg.includes('ui') || lowerMsg.includes('设计') || lowerMsg.includes('product') || lowerMsg.includes('界面')) {
        targetTab = 'product';
    } else if (lowerMsg.includes('开发文档') || lowerMsg.includes('技术文档') || lowerMsg.includes('tech') || lowerMsg.includes('技术方案')) {
        targetTab = 'tech';
    } else if (lowerMsg.includes('原型') || lowerMsg.includes('代码') || lowerMsg.includes('demo') || lowerMsg.includes('预览') || lowerMsg.includes('网页')) {
        targetTab = 'demo';
    } else if (lowerMsg.includes('报告') || lowerMsg.includes('汇报') || lowerMsg.includes('report') || lowerMsg.includes('总结')) {
        targetTab = 'report';
    }

    // Auto-switch tab if different
    if (targetTab !== activeTab) {
        setActiveTab(targetTab);
        // Add a small system message to indicate switching
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        // Delay slightly to allow tab switch to render (though React state batching handles this, the visual feedback is nice)
        await generateContent(targetTab, userMsg);
    } else {
        // Always generate/refine for the CURRENT active tab when chatting
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        await generateContent(activeTab, userMsg);
    }
  };

  // --- Renderers ---

  const handleFileUpload = async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    if (currentProjectId) {
      formData.append('project_id', currentProjectId);
    }
    
    try {
      const res = await axios.post('/api/v1/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      message.success(`${file.name} 上传成功`);
      
      // 如果是图片，可以在聊天框插入图片引用
      if (type === 'image') {
        setChatInput(prev => prev + `\n![${file.name}](/api/v1/files/download/${res.data.id})`);
      } else {
        setChatInput(prev => prev + `\n[附件: ${file.name}](/api/v1/files/download/${res.data.id})`);
      }
    } catch (e) {
      message.error(`${file.name} 上传失败`);
    }
    return false; // 阻止自动上传
  };

  const renderChatPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1D1F21', overflow: 'hidden' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              minWidth: '100px', // Prevent super narrow bubbles
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              overflow: 'hidden', // Ensure content doesn't spill out
              flexShrink: 0 // 防止消息被挤压
          }}>
            <div style={{ 
                background: msg.role === 'user' ? '#0FB698' : '#3B4E53',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: '12px',
                borderTopLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                fontSize: '14px',
                lineHeight: '1.5',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ overflowX: 'auto' }}> {/* Add horizontal scroll for code blocks */}
                <ReactMarkdown components={{
                  p: ({node, ...props}) => <p style={{ margin: 0, padding: 0 }} {...props} />,
                  code: ({node, inline, className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline ? (
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', margin: '8px 0', overflowX: 'auto', maxWidth: '100%' }}>
                        <code className={className} style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} {...props}>
                          {children}
                        </code>
                      </div>
                    ) : (
                      <code className={className} style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace' }} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '16px', borderTop: '1px solid #3B4E53', background: '#1D1F21' }}>
        {/* 元素选择模式下的浮动提示 */}
        {activeTab === 'demo' && selectedElements.length > 0 && !isSelectionConfirmed && (
          <div style={{ 
            marginBottom: 8, 
            padding: '10px', 
            background: 'rgba(15,182,152,0.1)', 
            borderRadius: 8, 
            border: '1px solid #0FB698',
            borderLeft: '4px solid #0FB698',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: 13, color: '#0FB698', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold' }}>发现 {selectedElements.length} 个待引用节点</span>
              <Space>
                <Button 
                  type="primary" 
                  size="small" 
                  onClick={() => {
                    setIsSelectionMode(false);
                    setIsSelectionConfirmed(true);
                    message.success('已添加为对话上下文');
                  }} 
                  style={{ fontSize: 11, height: 24, background: '#0FB698', borderColor: '#0FB698' }}
                >
                  引用这些元素
                </Button>
                <Button 
                  type="text" 
                  size="small" 
                  onClick={() => setSelectedElements([])} 
                  style={{ fontSize: 11, height: 24, color: '#ff4d4f' }}
                >
                  清空
                </Button>
              </Space>
            </div>
          </div>
        )}

        <div style={{ 
            background: '#111315', 
            border: '1px solid #3B4E53', 
            borderRadius: '6px',
            marginBottom: '8px',
            display: 'flex',
            flexDirection: 'column'
        }}>
          {/* 类似 Trae 的内嵌标签 (Context Tag Inside) */}
          {activeTab === 'demo' && selectedElements.length > 0 && isSelectionConfirmed && (
            <div style={{ 
              padding: '8px 8px 0 8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}>
              {selectedElements.map((el, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    padding: '2px 8px',
                    background: '#3B4E53',
                    color: '#00ECC8',
                    borderRadius: '4px',
                    fontSize: '11px',
                    border: '1px solid #0FB698',
                    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
                    pointerEvents: 'auto',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis'
                  }}
                >
                  <AimOutlined style={{ fontSize: '12px', color: '#00ECC8', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{el.traceId || el.selector.split('>').pop().trim()}</span>
                  <CloseOutlined 
                    style={{ fontSize: '9px', cursor: 'pointer', marginLeft: '4px', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} 
                    onClick={() => {
                      const newElements = selectedElements.filter((_, i) => i !== idx);
                      setSelectedElements(newElements);
                      if (newElements.length === 0) setIsSelectionConfirmed(false);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          
          <TextArea 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={isSelectionConfirmed && selectedElements.length > 0 ? "" : `给 ${getActiveTabName()} 下指令... (Shift+Enter 换行)`}
              autoSize={{ minRows: 2, maxRows: 6 }}
              onPressEnter={(e) => {
                  if (!e.shiftKey) {
                      e.preventDefault();
                      if (loading || isDemoLoading) return;
                      handleChatSubmit();
                  }
              }}
              style={{ 
                padding: '8px',
                border: 'none',
                boxShadow: 'none',
                background: 'transparent',
                color: '#fff',
                resize: 'none'
              }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
                    <Upload 
                        showUploadList={false} 
                        beforeUpload={(file) => handleFileUpload(file, 'file')}
                    >
                        <Button icon={<PaperClipOutlined />} size="small" style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', border: '1px solid #3B4E53' }}>附件</Button>
                    </Upload>
                    <Upload 
                        accept="image/*"
                        showUploadList={false} 
                        beforeUpload={(file) => handleFileUpload(file, 'image')}
                    >
                        <Button icon={<UploadOutlined />} size="small" style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', border: '1px solid #3B4E53' }}>图片</Button>
                    </Upload>
                </Space>
            <Space>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Enter 发送</Text>
                {loading || isDemoLoading ? (
                  <Button 
                    danger
                    icon={<StopOutlined />} 
                    onClick={handleStopGeneration} 
                    style={{ background: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
                  >
                    停止
                  </Button>
                ) : (
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />} 
                    onClick={handleChatSubmit} 
                    style={{ background: '#0FB698', borderColor: '#0FB698' }}
                  >
                    发送
                  </Button>
                )}
            </Space>
        </div>
      </div>
    </div>
  );

  const renderWorkspace = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#111315' }}>
        <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            type="card"
            style={{ margin: 0, padding: '8px 16px 0', background: '#1D1F21' }}
            items={[
                { label: <span style={{ color: activeTab === 'requirements' ? '#0FB698' : 'rgba(255,255,255,0.65)' }}><FileTextOutlined /> PRD文档</span>, key: 'requirements' },
                { label: <span style={{ color: activeTab === 'product' ? '#0FB698' : 'rgba(255,255,255,0.65)' }}><AppstoreOutlined /> UI设计文档</span>, key: 'product' },
                { label: <span style={{ color: activeTab === 'tech' ? '#0FB698' : 'rgba(255,255,255,0.65)' }}><DesktopOutlined /> 开发文档</span>, key: 'tech' },
                { label: <span style={{ color: activeTab === 'demo' ? '#0FB698' : 'rgba(255,255,255,0.65)' }}><CodeOutlined /> 原型展示</span>, key: 'demo' },
                { label: <span style={{ color: activeTab === 'report' ? '#0FB698' : 'rgba(255,255,255,0.65)' }}><BarChartOutlined /> 项目报告</span>, key: 'report' },
            ]}
        />
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px', background: '#111315', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#1D1F21', flex: 1, borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #3B4E53' }}>
                {activeTab === 'requirements' && renderSingleEditor(requirementsDoc, setRequirementsDoc, 'PRD文档')}
                {activeTab === 'product' && renderSingleEditor(productDoc, setProductDoc, 'UI设计文档')}
                {activeTab === 'tech' && renderSingleEditor(techDoc, setTechDoc, '开发文档')}
                {activeTab === 'demo' && renderDemoPreview()}
                {activeTab === 'report' && renderReport()}
            </div>
            
            {/* Next Step Button Bar */}
            <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center' }}>
                {activeTab !== 'report' && (
                    <Button 
                        type="primary" 
                        size="large" 
                        onClick={handleNextStep}
                        disabled={loading || isDemoLoading}
                        style={{ width: 200, borderRadius: 20, background: '#0FB698', borderColor: '#0FB698', boxShadow: '0 4px 10px rgba(15,182,152,0.3)' }}
                    >
                        下一步：{getNextTabName()}
                    </Button>
                )}
            </div>
        </div>
    </div>
  );

  const handleNextStep = () => {
      let nextTab = '';
      if (activeTab === 'requirements') nextTab = 'product';
      else if (activeTab === 'product') nextTab = 'tech';
      else if (activeTab === 'tech') nextTab = 'demo';
      else if (activeTab === 'demo') nextTab = 'report';
      
      if (nextTab) {
          setActiveTab(nextTab);
          // Automatically trigger generation for the next stage
          generateContent(nextTab);
      }
  };

  const getNextTabName = () => {
      if (activeTab === 'requirements') return 'UI设计文档';
      if (activeTab === 'product') return '开发文档';
      if (activeTab === 'tech') return '原型展示';
      if (activeTab === 'demo') return '项目报告';
      return '';
  };

  const renderSingleEditor = (content, setContent, title) => (
      <SingleEditor 
          content={content} 
          setContent={setContent} 
          title={title} 
          onSave={() => saveProject(activeTab, content)} 
      />
  );

  const renderReport = () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1D1F21' }}>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #3B4E53', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1D1F21' }}>
              <Space>
                  <BarChartOutlined style={{ fontSize: '18px', color: '#0FB698' }} />
                  <Title level={5} style={{ margin: 0, color: '#fff' }}>项目总结汇报报告</Title>
              </Space>
              <Space>
                  <Button 
                      icon={<RocketOutlined />} 
                      onClick={() => generateContent('report')}
                      loading={loading}
                      style={{ background: 'transparent', color: '#0FB698', borderColor: '#0FB698' }}
                  >
                      重新生成报告
                  </Button>
                  {reportContent && (
                      <Button 
                           icon={<DesktopOutlined />} 
                           onClick={() => {
                               const win = window.open('', '_blank');
                               win.document.write(reportContent);
                               win.document.close();
                           }}
                           style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', border: '1px solid #3B4E53' }}
                       >
                           浏览器全屏预览
                       </Button>
                   )}
                   {reportContent && (
                       <Button 
                           icon={<FileMarkdownOutlined />} 
                           onClick={async () => {
                               try {
                                   await navigator.clipboard.writeText(reportContent);
                                   message.success('报告 HTML 代码已复制到剪贴板');
                               } catch (err) {
                                   message.error('复制失败，请手动复制');
                               }
                           }}
                           style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', border: '1px solid #3B4E53' }}
                       >
                           复制 HTML
                       </Button>
                   )}
                   <Button 
                       type="primary" 
                      icon={<DownloadOutlined />} 
                      onClick={() => {
                          const iframe = document.getElementById('report-iframe');
                          if (iframe) {
                              iframe.contentWindow.print();
                          }
                      }}
                      style={{ background: '#0FB698', borderColor: '#0FB698' }}
                  >
                      导出 PDF / 打印
                  </Button>
              </Space>
          </div>
          <div style={{ flex: 1, background: '#111315', padding: '20px', overflow: 'hidden', position: 'relative' }}>
              {loading && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1D1F21' }}>
                      <Spin size="large" tip="正在为您生成精美汇报报告..." />
                  </div>
              )}
              {reportContent && !loading ? (
                    <iframe 
                        id="report-iframe"
                        srcDoc={injectProjectId(reportContent, 'report')} 
                        key={reportContent.length} // Fix: Preview flicker by keying on content length or similar stable value
                        style={{ 
                            width: '100%', 
                          height: '100%', 
                          border: 'none', 
                          background: '#fff', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}
                      title="项目报告"
                  />
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1D1F21', borderRadius: '8px', border: '1px solid #3B4E53' }}>
                      <Empty description={<span style={{ color: 'rgba(255,255,255,0.45)' }}>尚未生成项目报告</span>} />
                      <Button type="primary" onClick={() => generateContent('report')} loading={loading} style={{ marginTop: 16, background: '#0FB698', borderColor: '#0FB698' }}>
                          立即生成汇报报告
                      </Button>
                  </div>
              )}
          </div>
      </div>
  );

  const renderDemoPreview = () => (
      <div style={{ display: 'flex', height: '100%', background: '#111315' }}>
          <div style={{ flex: 1, padding: '0', borderRight: '1px solid #3B4E53', display: 'flex', flexDirection: 'column', background: '#1D1F21' }}>
               <div style={{ padding: '12px 16px', borderBottom: '1px solid #3B4E53', background: '#1D1F21', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <Text strong style={{ color: '#fff' }}>代码编辑</Text>
                   <Space>
                     <Button 
                        type="primary"
                        size="small"
                        icon={<HistoryOutlined />}
                        onClick={() => {
                            setDemoPreviewCode(demoCode);
                            saveProject('demo', demoCode);
                            message.success('已刷新预览');
                        }}
                        style={{ background: '#0FB698', borderColor: '#0FB698', fontSize: '12px' }}
                     >
                        运行代码
                     </Button>
                     <Text type="secondary" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>失焦自动保存</Text>
                   </Space>
               </div>
               <TextArea 
                  ref={editorRef}
                  className="demo-code-editor"
                  value={demoCode} 
                  onChange={e => setDemoCode(e.target.value)} 
                  onBlur={() => {
                      saveProject('demo', demoCode);
                      setDemoPreviewCode(demoCode);
                  }}
                  style={{ 
                      flex: 1, 
                      resize: 'none', 
                      border: 'none', 
                      fontFamily: 'monospace', 
                      borderRadius: 0, 
                      padding: 16,
                      fontSize: 13,
                      lineHeight: 1.8,
                      background: '#1D1F21',
                      color: '#fff'
                  }}
              />
          </div>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: '#111315' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #3B4E53', background: '#1D1F21', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <Text strong style={{ color: '#fff' }}>实时效果预览</Text>
                   <Space>
                        {selectedElements.length > 0 && (
                            <Tag color="#0FB698" closable onClose={() => setSelectedElements([])} style={{ border: 'none' }}>
                                已选 {selectedElements.length} 个元素
                            </Tag>
                        )}
                        <Button 
                            type={isSelectionMode ? "primary" : "default"}
                            size="small"
                            icon={<SelectOutlined />} 
                            onClick={() => setIsSelectionMode(!isSelectionMode)}
                            danger={isSelectionMode}
                            style={{ 
                              background: isSelectionMode ? '#ff4d4f' : 'transparent',
                              borderColor: isSelectionMode ? '#ff4d4f' : '#3B4E53',
                              color: isSelectionMode ? '#fff' : 'rgba(255,255,255,0.65)'
                            }}
                        >
                            {isSelectionMode ? "退出选择" : "选择元素"}
                        </Button>
                        <Button 
                            type="primary" 
                            size="small"
                            icon={<RocketOutlined />} 
                            onClick={handlePublish}
                            style={{ background: '#0FB698', borderColor: '#0FB698' }}
                        >
                            一键发布
                        </Button>
                        <Button 
                             type="text" 
                             icon={<FullscreenOutlined style={{ color: 'rgba(255,255,255,0.65)' }} />} 
                             onClick={() => setFullscreen(true)}
                             title="全屏预览"
                        />
                   </Space>
               </div>
               <div 
                  ref={previewContainerRef} 
                  style={{ 
                    flex: 1, 
                    overflow: 'auto', 
                    background: '#111315', 
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px 0'
                  }}
               >
                  <div style={{ 
                      width: 1280, 
                      height: '100%',
                      minHeight: 800,
                      transform: `scale(${previewScale})`, 
                      transformOrigin: 'top center',
                      background: '#fff',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                      transition: 'transform 0.2s ease-out',
                      borderRadius: '4px',
                      overflow: 'hidden'
                  }}>
                      {demoPreviewCode ? (
                        <iframe 
                             ref={iframeRef}
                             key={demoPreviewCode.length} // Force re-render on content change
                             srcDoc={injectProjectId(demoPreviewCode)} 
                             style={{ width: '100%', height: '100%', border: 'none' }}
                             title="原型预览"
                             onLoad={() => {
                               if (iframeRef.current && iframeRef.current.contentWindow) {
                                 iframeRef.current.contentWindow.postMessage({ 
                                   type: 'SET_SELECTION_MODE', 
                                   enabled: isSelectionMode 
                                 }, '*');
                               }
                             }}
                         />
                      ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.45)' }}>
                              <CodeOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
                              <p>暂无预览内容</p>
                              <Button size="small" type="link" onClick={() => setDemoPreviewCode(demoCode)}>尝试加载代码</Button>
                          </div>
                      )}
                  </div>

                  {/* 预览区加载遮罩 */}
                  {isDemoLoading && (
                      <div style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          right: 0, 
                          bottom: 0, 
                          zIndex: 1000, // Increased z-index
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          background: 'rgba(17,19,21,0.7)',
                          backdropFilter: 'blur(2px)'
                      }}>
                          <Spin size="large" tip="正在为您更新原型预览..." />
                      </div>
                  )}
              </div>

               {/* Fullscreen Modal */}
               <Modal
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
                            <span>全屏演示 - {projectName}</span>
                        </div>
                    }
                    open={fullscreen}
                    footer={null}
                    onCancel={() => setFullscreen(false)}
                    width="100vw"
                    style={{ top: 0, padding: 0, maxWidth: '100vw' }}
                    styles={{ body: { height: 'calc(100vh - 55px)', padding: 0 } }}
                    closeIcon={<FullscreenExitOutlined style={{ fontSize: 18 }} />}
               >
                    <iframe 
                        srcDoc={demoPreviewCode} 
                        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                        title="原型全屏预览"
                    />
               </Modal>
          </div>
      </div>
  );

  const getActiveTabName = () => {
      switch(activeTab) {
          case 'requirements': return 'PRD文档';
          case 'product': return 'UI设计文档';
          case 'tech': return '开发文档';
          case 'demo': return '原型展示';
          case 'report': return '项目报告';
          default: return '';
      }
  }

  const renderHeader = () => (
    <Header style={{ background: '#1D1F21', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #3B4E53', height: '64px' }}>
      <Space size="large">
        <Typography.Title level={4} style={{ margin: 0, color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '32px', height: '32px', background: '#0FB698', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
            <RobotOutlined style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          至创-智能开发系统
        </Typography.Title>
      </Space>
      
      <Space size="middle">
        {isLoggedIn ? (
          <Space>
            <Dropdown menu={{
              items: [
                ...(isAdmin ? [{
                  key: 'admin',
                  icon: <CrownOutlined />,
                  label: '管理后台',
                  onClick: () => { setShowAdmin(true); fetchLicenses(); }
                }] : []),
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: handleLogout
                }
              ]
            }}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
                <Avatar style={{ backgroundColor: '#0FB698', marginRight: 8 }} icon={<UserOutlined />} size="small" />
                <Typography.Text style={{ color: '#fff' }}>{username}</Typography.Text>
              </div>
            </Dropdown>
          </Space>
        ) : (
           <Button type="primary" onClick={() => setShowLogin(true)} style={{ background: '#0FB698', borderColor: '#0FB698' }}>登录 / 注册</Button>
         )}
         <Button icon={<PlusOutlined />} type="primary" onClick={createNewProject} style={{ background: '#0FB698', borderColor: '#0FB698' }}>新建项目</Button>
         <SelectProject projects={projects} currentId={currentProjectId} onSelect={loadProject} onDelete={deleteProject} />
       </Space>
     </Header>
   );

   const renderLoginModal = () => (
     <Modal
      title="登录 / 注册"
      open={showLogin}
      onCancel={() => setShowLogin(false)}
      footer={null}
      destroyOnHidden
    >
       <Form
         form={loginForm}
         name="login_form"
         initialValues={{ remember: true }}
         onFinish={handleLogin}
       >
         <Form.Item
           name="username"
           rules={[{ required: true, message: '请输入用户名' }]}
         >
           <Input prefix={<UserOutlined />} placeholder="用户名" />
         </Form.Item>
         <Form.Item
           name="password"
           rules={[{ required: true, message: '请输入密码' }]}
         >
           <Input.Password prefix={<LockOutlined />} placeholder="密码" />
         </Form.Item>
         <Form.Item>
           <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
             登录
           </Button>
         </Form.Item>
         <Divider plain>或者</Divider>
         <div style={{ textAlign: 'center' }}>
           <Button type="link" onClick={handleRegister} loading={loading}>
             立即注册
           </Button>
         </div>
       </Form>
     </Modal>
   );

  const renderAdminModal = () => (
    <Modal
      title={<span><CrownOutlined style={{ marginRight: 8 }} />行至智能 - 商业化管理后台</span>}
      open={showAdmin}
      onCancel={() => setShowAdmin(false)}
      width={1000}
      footer={null}
      destroyOnHidden
    >
      <Tabs 
        defaultActiveKey="generate"
        items={[
          {
            key: 'generate',
            label: <span><KeyOutlined />生成授权码</span>,
            children: (
              <Card size="small" title="为客户创建新授权">
                <Form
                  form={adminForm}
                  layout="vertical"
                  onFinish={handleGenerateLicense}
                  initialValues={{ max_calls: 100, valid_days: 30 }}
                >
                  <Space align="start" size="large">
                    <Form.Item
                      name="username"
                      label="客户用户名"
                      rules={[{ required: true, message: '请输入要授权的用户名' }]}
                    >
                      <Input placeholder="例如: client_001" style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item
                      name="max_calls"
                      label="最大调用次数"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item
                      name="valid_days"
                      label="有效天数"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item label=" " style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" loading={licenseLoading}>
                        生成并激活
                      </Button>
                    </Form.Item>
                  </Space>
                </Form>
              </Card>
            )
          },
          {
            key: 'monitor',
            label: <span><BarChartOutlined />用量监控</span>,
            children: (
              <Table
                dataSource={licenses}
                loading={licenseLoading}
                rowKey="id"
                columns={[
                  { title: '客户', dataIndex: 'username', key: 'username' },
                  { title: '授权码', dataIndex: 'license_key', key: 'license_key', render: k => <Tag color="blue">{k}</Tag> },
                  { 
                    title: '使用情况', 
                    key: 'usage',
                    render: (_, record) => (
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <Text size="small">{record.used_calls} / {record.max_calls}</Text>
                        <div style={{ width: '100%', height: 4, background: '#f5f5f5', borderRadius: 2 }}>
                          <div style={{ 
                            width: `${Math.min(100, (record.used_calls / record.max_calls) * 100)}%`, 
                            height: '100%', 
                            background: record.used_calls >= record.max_calls ? '#ff4d4f' : '#52c41a',
                            borderRadius: 2
                          }} />
                        </div>
                      </Space>
                    )
                  },
                  { 
                    title: '到期时间', 
                    dataIndex: 'expires_at', 
                    key: 'expires_at',
                    render: d => {
                      const date = new Date(d);
                      const isExpired = date < new Date();
                      return <Tag color={isExpired ? 'red' : 'green'}>{date.toLocaleDateString()}</Tag>
                    }
                  },
                  { 
                    title: '状态', 
                    dataIndex: 'is_active', 
                    key: 'is_active',
                    render: active => active ? <Tag color="cyan">生效中</Tag> : <Tag color="default">已失效</Tag>
                  }
                ]}
              />
            )
          }
        ]}
      />
    </Modal>
  );

  const renderShareModal = () => (
    <Modal
      title="项目已发布"
      open={showShareModal}
      onCancel={() => setShowShareModal(false)}
      footer={[
        <Button key="close" onClick={() => setShowShareModal(false)}>关闭</Button>,
        <Button key="copy" type="primary" onClick={() => {
          navigator.clipboard.writeText(shareUrl);
          message.success('链接已复制到剪贴板');
        }}>复制链接</Button>
      ]}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <RocketOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
        <p>您的原型系统已成功发布，可以发送给甲方预览了：</p>
        <Input value={shareUrl} readOnly style={{ width: '100%', marginBottom: 8 }} />
        <Text type="secondary">提示：该链接为公网预览链接，无需登录即可查看。</Text>
      </div>
    </Modal>
  );

  return (
    <Layout style={{ height: '100vh', background: '#111315' }}>
      <style>{`
        .demo-code-editor textarea::selection {
          background: #ffff00 !important;
          color: #000 !important;
        }
        /* 确保即使失去焦点，某些浏览器也能看到淡淡的选择效果 */
        .demo-code-editor textarea:not(:focus)::selection {
          background: rgba(255, 255, 0, 0.3) !important;
        }
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
          background: transparent !important;
          border-color: #3B4E53 !important;
        }
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active {
          background: #111315 !important;
          border-bottom-color: #111315 !important;
        }
        .ant-drawer-content {
          background-color: #1D1F21 !important;
          color: #fff !important;
        }
        .ant-drawer-header-title .ant-drawer-title {
          color: #fff !important;
        }
        .ant-list-item-meta-title {
          color: #fff !important;
        }
        .ant-list-item-meta-description {
          color: rgba(255,255,255,0.45) !important;
        }
        /* 增强 Textarea Placeholder 可见度 */
        textarea::placeholder {
          color: rgba(255, 255, 255, 0.5) !important;
          font-style: italic;
        }
      `}</style>
      {renderHeader()}
      <Layout style={{ background: '#111315', overflow: 'hidden' }}>
        {/* Left Chat Sider */}
        <Sider width={350} theme="dark" style={{ borderRight: '1px solid #3B4E53', background: '#1D1F21' }}>
          {renderChatPanel()}
        </Sider>
        
        {/* Main Content Area */}
        <Content style={{ background: '#111315' }}>
          {renderWorkspace()}
        </Content>
      </Layout>
      {renderLoginModal()}
      {renderAdminModal()}
      {renderShareModal()}
    </Layout>
  );
};

// Simple Project Selector Component
const SelectProject = ({ projects, currentId, onSelect, onDelete }) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button 
              icon={<HistoryOutlined />} 
              onClick={() => setOpen(true)}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', borderColor: '#3B4E53' }}
            >
              历史项目
            </Button>
            <Drawer
                title={<span style={{ color: '#fff' }}>项目列表</span>}
                placement="left"
                onClose={() => setOpen(false)}
                open={open}
                width={320}
                styles={{ body: { padding: '16px', background: '#1D1F21' }, header: { background: '#1D1F21', borderBottom: '1px solid #3B4E53' } }}
            >
                 <List
                    dataSource={projects}
                    renderItem={item => (
                        <List.Item 
                            style={{ 
                                padding: '12px 16px', 
                                cursor: 'pointer', 
                                borderRadius: 8,
                                marginBottom: 8,
                                background: currentId === item.id ? 'rgba(15,182,152,0.1)' : '#111315',
                                border: currentId === item.id ? '1px solid #0FB698' : '1px solid #3B4E53',
                                position: 'relative'
                            }}
                            onClick={() => { onSelect(item.id); setOpen(false); }}
                            actions={[
                                <Button 
                                    type="text" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    onClick={(e) => onDelete(item.id, e)}
                                    style={{ color: '#ff4d4f' }}
                                />
                            ]}
                        >
                            <List.Item.Meta 
                                avatar={<AppstoreOutlined style={{ color: currentId === item.id ? '#0FB698' : 'rgba(255,255,255,0.45)' }} />}
                                title={<span style={{ color: currentId === item.id ? '#0FB698' : '#fff' }}>{item.name}</span>} 
                                description={new Date(item.updated_at).toLocaleDateString()} 
                            />
                        </List.Item>
                    )}
                 />
            </Drawer>
        </>
    )
}

export default App;
