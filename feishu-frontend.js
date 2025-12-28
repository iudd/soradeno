// Feishu Frontend - 飞书批量生成前端逻辑
console.log('%c🚀 Feishu Frontend v2.0 (Dashboard Overhaul) Loaded at ' + new Date().toLocaleTimeString(), 'color: #6366f1; font-weight: bold; font-size: 14px;');
let feishuTasks = [];
let isProcessing = false; // 全局锁，防止同时运行多个任务

function getFeishuStreamEl() {
    let el = document.getElementById('feishuStreamOutput');
    if (!el) {
        el = document.createElement('div');
        el.id = 'feishuStreamOutput';
        el.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 450px;
            height: 80vh;
            background: #0f172a;
            color: #38bdf8;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            font-family: 'Fira Code', monospace;
            font-size: 12px;
            display: flex;
            flex-direction: column;
            border: 1px solid #334155;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px;';
        header.innerHTML = '<span style="font-weight:bold;color:#f1f5f9;">🚀 上游实时反馈控制台</span>';

        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;';
        closeBtn.onclick = () => el.style.display = 'none';
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.id = 'feishuStreamContent';
        content.style.cssText = 'flex:1;overflow-y:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;';

        el.appendChild(header);
        el.appendChild(content);
        document.body.appendChild(el);
    }
    return el;
}

function updateFeishuStatus(msg, type) {
    const streamEl = getFeishuStreamEl();
    const contentEl = document.getElementById('feishuStreamContent');
    streamEl.style.display = 'flex';

    const time = new Date().toLocaleTimeString('zh-CN');
    const colors = { info: '#38bdf8', success: '#10b981', error: '#ef4444', warning: '#f59e0b' };
    const color = colors[type] || '#94a3b8';

    const logLine = document.createElement('div');
    logLine.style.color = color;
    logLine.style.marginBottom = '4px';
    logLine.innerHTML = `<span style="color:#64748b;">[${time}]</span> ${msg}`;
    contentEl.appendChild(logLine);
    contentEl.scrollTop = contentEl.scrollHeight;

    // 同时更新原有的日志区域（如果存在）
    let el = document.getElementById('feishuLog');
    if (el) {
        el.innerHTML = `<div style="font-size:13px;color:#94a3b8;">[${time}] ${msg}</div>` + el.innerHTML;
    }
}

async function loadFeishuTasks() {
    console.log('🔄 loadFeishuTasks called');
    const list = document.getElementById('feishuTaskList');
    const btn = document.getElementById('batchGenerateBtn');
    list.innerHTML = '<p style="text-align:center;padding:2rem;">加载中...</p>';
    btn.disabled = true;
    updateFeishuStatus('正在加载飞书数据...', 'info');

    try {
        const res = await fetch('/api/feishu/records');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const all = data.records || [];
        const pending = all.filter(r => !r.isGenerated && r.prompt);
        const done = all.filter(r => r.isGenerated);
        feishuTasks = pending;

        updateFeishuStatus(`加载完成: ${all.length}条, 待生成${pending.length}, 已完成${done.length}`, 'success');
        btn.disabled = pending.length === 0;

        let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#1e293b; padding:15px; border-radius:12px; border:1px solid #334155;">
            <div style="display:flex; gap:20px;">
                <div style="text-align:center;"><div style="color:#94a3b8; font-size:11px; text-transform:uppercase;">总计</div><div style="color:#f1f5f9; font-size:18px; font-weight:bold;">${all.length}</div></div>
                <div style="text-align:center;"><div style="color:#f59e0b; font-size:11px; text-transform:uppercase;">待处理</div><div style="color:#f59e0b; font-size:18px; font-weight:bold;">${pending.length}</div></div>
                <div style="text-align:center;"><div style="color:#10b981; font-size:11px; text-transform:uppercase;">已完成</div><div style="color:#10b981; font-size:18px; font-weight:bold;">${done.length}</div></div>
            </div>
            <button onclick="loadFeishuTasks()" class="btn btn-secondary" style="padding:8px 15px; font-size:13px; display:flex; align-items:center; gap:6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path></svg>
                刷新数据
            </button>
        </div>`;

        if (pending.length > 0) {
            html += '<h3 style="color:#f1f5f9; margin:25px 0 15px; font-size:16px; display:flex; align-items:center; gap:8px;">⏳ 待生成任务列表</h3>';
            pending.forEach(t => {
                const p = t.prompt || '(无提示词)';
                const errorDisplay = t.error ? `
                    <div style="margin-top:12px; padding:10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px;">
                        <div style="color:#ef4444; font-size:11px; font-weight:bold; margin-bottom:4px;">❌ 错误信息</div>
                        <div style="color:#fca5a5; font-size:12px; font-family:monospace;">${t.error}</div>
                    </div>` : '';

                html += `
                <div class="history-item" id="task-${t.recordId}" style="margin-bottom:20px; flex-direction:column; align-items:stretch; padding:20px; background:#0f172a; border:1px solid #334155; border-radius:12px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
                    <div style="border-bottom:1px solid #1e293b; padding-bottom:12px; margin-bottom:15px;">
                        <div style="color:#94a3b8; font-size:11px; margin-bottom:6px; text-transform:uppercase;">提示词 (Prompt)</div>
                        <div style="color:#f1f5f9; font-size:14px; line-height:1.6; font-weight:500;">${p}</div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom:15px;">
                        <div><div style="color:#64748b; font-size:11px;">角色</div><div style="color:#e2e8f0; font-size:13px;">${t.character || '-'}</div></div>
                        <div><div style="color:#64748b; font-size:11px;">模型</div><div style="color:#e2e8f0; font-size:13px;">${t.modelDisplay || t.model}</div></div>
                        <div><div style="color:#64748b; font-size:11px;">生成状态</div><div style="color:${t.status === '失败' ? '#ef4444' : '#f59e0b'}; font-size:13px; font-weight:bold;">${t.status}</div></div>
                        <div><div style="color:#64748b; font-size:11px;">是否已生成</div><div style="color:#e2e8f0; font-size:13px;">${t.isGenerated ? '✅ 是' : '❌ 否'}</div></div>
                        <div><div style="color:#64748b; font-size:11px;">生成时间</div><div style="color:#e2e8f0; font-size:13px;">${t.createdTime || '-'}</div></div>
                        <div><div style="color:#64748b; font-size:11px;">记录ID</div><div style="color:#475569; font-size:11px; font-family:monospace;">${t.recordId}</div></div>
                    </div>

                    <div style="background:#1e293b; padding:12px; border-radius:8px; display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:#94a3b8; font-size:11px; min-width:70px;">视频URL:</span>
                            ${t.videoUrl ? `<a href="${t.videoUrl}" target="_blank" style="color:#6366f1; font-size:12px; text-decoration:underline; word-break:break-all;">${t.videoUrl}</a>` : '<span style="color:#475569; font-size:12px;">暂无</span>'}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:#94a3b8; font-size:11px; min-width:70px;">图片URL:</span>
                            ${t.imageUrl ? `<a href="${t.imageUrl}" target="_blank" style="color:#6366f1; font-size:12px; text-decoration:underline; word-break:break-all;">${t.imageUrl}</a>` : '<span style="color:#475569; font-size:12px;">暂无</span>'}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:#94a3b8; font-size:11px; min-width:70px;">Sora图片:</span>
                            <span style="color:#64748b; font-size:11px; word-break:break-all;">${t.soraImage || '无参考图'}</span>
                        </div>
                    </div>

                    ${errorDisplay}

                    <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                        <button class="btn btn-primary" id="btn-${t.recordId}" onclick="genTask('${t.recordId}')" style="padding:10px 25px; font-size:14px; font-weight:bold; box-shadow:0 4px 6px -1px rgba(99,102,241,0.4);">
                            ${t.status === '失败' ? '🔄 重试生成' : '🎬 开始生成'}
                        </button>
                    </div>
                </div>`;
            });
        }

        if (done.length > 0) {
            html += '<h4 style="color:#10b981; margin:20px 0 10px;">✅ 已完成任务 (显示5条)</h4>';
            done.slice(0, 5).forEach(t => {
                const p = t.prompt || '(无)';
                const characterInfo = t.character ? `<div><span style="color:#94a3b8;">角色:</span> <span style="color:#e2e8f0;">${t.character}</span></div>` : '';
                const modelInfo = `<div><span style="color:#94a3b8;">模型:</span> <span style="color:#e2e8f0;">${t.modelDisplay || t.model}</span></div>`;
                const timeInfo = t.createdTime ? `<div><span style="color:#94a3b8;">完成时间:</span> <span style="color:#e2e8f0;">${t.createdTime}</span></div>` : '';

                let mediaLinks = '';
                if (t.videoUrl) mediaLinks += `<div style="margin-top:4px;"><span style="color:#94a3b8;">视频URL:</span> <a href="${t.videoUrl}" target="_blank" style="color:#10b981; text-decoration:underline; font-size:11px; word-break:break-all;">${t.videoUrl}</a></div>`;
                if (t.imageUrl) mediaLinks += `<div style="margin-top:4px;"><span style="color:#94a3b8;">图片URL:</span> <a href="${t.imageUrl}" target="_blank" style="color:#10b981; text-decoration:underline; font-size:11px; word-break:break-all;">${t.imageUrl}</a></div>`;

                html += `<div class="history-item" style="margin-bottom:12px; flex-direction:column; align-items:stretch; padding:12px; border:1px solid #10b981; background:rgba(16,185,129,0.05);">
                    <div style="font-weight:600; color:#f1f5f9; margin-bottom:8px; border-bottom:1px solid rgba(16,185,129,0.2); padding-bottom:4px;">${p}</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:12px;">
                        ${characterInfo}
                        ${modelInfo}
                        ${timeInfo}
                        <div><span style="color:#94a3b8;">状态:</span> <span style="color:#10b981; font-weight:bold;">成功</span></div>
                    </div>
                    ${mediaLinks}
                </div>`;
            });
        }

        list.innerHTML = html;
    } catch (e) {
        updateFeishuStatus('加载失败: ' + e.message, 'error');
        list.innerHTML = `<p style="color:#ef4444;text-align:center;padding:2rem;">❌ ${e.message}</p>`;
    }
}

async function genTask(id) {
    console.log('🚀 [genTask] 开始生成任务:', id);

    if (isProcessing) {
        console.warn('⚠️ [genTask] 已有任务在处理中，跳过');
        updateFeishuStatus('⚠️ 正在处理其他任务，请稍候...', 'warning');
        return false;
    }

    isProcessing = true;
    const btn = document.getElementById('btn-' + id);
    const task = feishuTasks.find(t => t.recordId === id);
    console.log('📋 [genTask] 任务详情:', task);

    if (btn) { btn.disabled = true; btn.innerHTML = '...'; }

    const streamEl = getFeishuStreamEl();
    const contentEl = document.getElementById('feishuStreamContent');
    streamEl.style.display = 'flex';

    // 添加任务分割线
    const separator = document.createElement('div');
    separator.style.cssText = 'border-top:1px dashed #334155;margin:15px 0;padding-top:10px;color:#f1f5f9;font-weight:bold;';
    separator.innerHTML = `📍 任务: ${id}`;
    contentEl.appendChild(separator);

    updateFeishuStatus(`开始生成: ${task ? task.prompt.slice(0, 30) : id}...`, 'info');

    try {
        console.log('📡 [genTask] 发送 POST 请求到:', '/api/feishu/generate/' + id);

        const response = await fetch('/api/feishu/generate/' + id, {
            method: 'POST'
        });

        console.log('📡 [genTask] 响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [genTask] HTTP 错误:', errorText);
            throw new Error(errorText || response.statusText);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let success = false;
        let resultData = null;

        // 创建一个专门用于显示流式内容的容器
        const streamTextContainer = document.createElement('span');
        streamTextContainer.style.color = '#e2e8f0';
        contentEl.appendChild(streamTextContainer);

        console.log('📖 [genTask] 开始读取 SSE 流...');

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('✅ [genTask] 流读取完成');
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        console.log('📦 [genTask] 解析到数据:', data);

                        if (data.type === 'log') {
                            updateFeishuStatus(data.message, 'info');
                        } else if (data.type === 'stream') {
                            // 实时打字机效果显示上游反馈
                            streamTextContainer.textContent += data.content;
                            contentEl.scrollTop = contentEl.scrollHeight;
                        } else if (data.type === 'result') {
                            success = data.success;
                            resultData = data;
                            console.log('🎯 [genTask] 收到最终结果:', resultData);
                        } else if (data.type === 'error') {
                            console.error('❌ [genTask] 收到错误:', data.message);
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        console.error('❌ [genTask] JSON 解析错误:', e);
                        console.error('❌ [原始数据]:', line);
                    }
                }
            }
        }

        if (success) {
            if (resultData.skipped) {
                updateFeishuStatus('⚠️ 任务已存在，跳过生成', 'warning');
            } else {
                updateFeishuStatus('✅ 生成成功! 已同步到飞书', 'success');
            }
            if (btn) { btn.innerHTML = '✅'; btn.style.background = '#10b981'; }
            return true;
        } else {
            throw new Error('生成未完成或失败');
        }

    } catch (e) {
        updateFeishuStatus('❌ 失败: ' + e.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '重试'; btn.style.background = '#ef4444'; }
        return false;
    } finally {
        isProcessing = false;
    }
}

async function batchGenerateVideos() {
    const tasks = feishuTasks.filter(t => t.prompt);
    if (!tasks.length) { updateFeishuStatus('没有待生成任务', 'warning'); return; }
    if (!confirm(`批量生成 ${tasks.length} 个视频?`)) return;

    const btn = document.getElementById('batchGenerateBtn');
    btn.disabled = true; btn.innerHTML = '生成中...';

    let ok = 0, fail = 0;
    for (let i = 0; i < tasks.length; i++) {
        updateFeishuStatus(`[${i + 1}/${tasks.length}] 处理中...`, 'info');
        const success = await genTask(tasks[i].recordId);
        if (success) { ok++; } else { fail++; }

        if (i < tasks.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    btn.disabled = false; btn.innerHTML = '🎬 批量生成全部';
    updateFeishuStatus(`🎉 完成! 成功${ok}, 失败${fail}`, ok > 0 ? 'success' : 'error');
    loadFeishuTasks();
}

window.loadFeishuTasks = loadFeishuTasks;
window.generateSingleTask = genTask;
window.genTask = genTask;
window.batchGenerateVideos = batchGenerateVideos;
