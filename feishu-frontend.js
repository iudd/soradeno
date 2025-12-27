// Feishu Frontend - 飞书批量生成前端逻辑
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

        let html = `<div style="background:#0f172a;padding:12px;border-radius:8px;margin-bottom:12px;">
            <span style="color:#94a3b8;">总计:<strong style="color:#f1f5f9;">${all.length}</strong></span>
            <span style="color:#f59e0b;margin-left:12px;">待生成:<strong>${pending.length}</strong></span>
            <span style="color:#10b981;margin-left:12px;">已完成:<strong>${done.length}</strong></span>
        </div>`;

        if (pending.length > 0) {
            html += '<h4 style="color:#f59e0b;margin:12px 0 8px;">⏳ 待生成</h4>';
            pending.forEach(t => {
                const p = t.prompt || '(无)';
                const characterInfo = t.character ? `<div><span style="color:#94a3b8;">角色:</span> <span style="color:#e2e8f0;">${t.character}</span></div>` : '';
                const modelInfo = `<div><span style="color:#94a3b8;">模型:</span> <span style="color:#e2e8f0;">${t.modelDisplay || t.model}</span></div>`;
                const statusInfo = `<div><span style="color:#94a3b8;">状态:</span> <span style="color:${t.status === '失败' ? '#ef4444' : '#10b981'}; font-weight:bold;">${t.status}</span></div>`;
                const timeInfo = t.createdTime ? `<div><span style="color:#94a3b8;">时间:</span> <span style="color:#e2e8f0;">${t.createdTime}</span></div>` : '';
                const isGeneratedInfo = `<div><span style="color:#94a3b8;">已生成:</span> <span style="color:#e2e8f0;">${t.isGenerated ? '是' : '否'}</span></div>`;
                const errorInfo = t.status === '失败' && t.error ? `<div style="color:#ef4444; font-size:11px; margin-top:4px; background:rgba(239,68,68,0.1); padding:4px; border-radius:4px;">❌ ${t.error}</div>` : '';

                let mediaLinks = '';
                if (t.videoUrl) mediaLinks += `<div style="margin-top:4px;"><span style="color:#94a3b8;">视频URL:</span> <a href="${t.videoUrl}" target="_blank" style="color:#6366f1; text-decoration:underline; font-size:11px; word-break:break-all;">${t.videoUrl}</a></div>`;
                if (t.imageUrl) mediaLinks += `<div style="margin-top:4px;"><span style="color:#94a3b8;">图片URL:</span> <a href="${t.imageUrl}" target="_blank" style="color:#6366f1; text-decoration:underline; font-size:11px; word-break:break-all;">${t.imageUrl}</a></div>`;
                if (t.soraImage) mediaLinks += `<div style="margin-top:4px;"><span style="color:#94a3b8;">Sora图片:</span> <span style="color:#94a3b8; font-size:11px; word-break:break-all;">${t.soraImage}</span></div>`;

                html += `<div class="history-item" id="task-${t.recordId}" style="margin-bottom:12px; flex-direction:column; align-items:stretch; padding:12px; border:1px solid #334155; background:#0f172a;">
                    <div style="margin-bottom:8px;">
                        <div style="font-weight:600; color:#f1f5f9; margin-bottom:8px; border-bottom:1px solid #1e293b; padding-bottom:4px;">${p}</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:12px;">
                            ${characterInfo}
                            ${modelInfo}
                            ${statusInfo}
                            ${isGeneratedInfo}
                            ${timeInfo}
                        </div>
                        ${mediaLinks}
                        ${errorInfo}
                    </div>
                    <div style="display:flex; justify-content: flex-end; margin-top:8px; border-top:1px solid #1e293b; padding-top:8px;">
                        <button class="btn btn-primary" id="btn-${t.recordId}" onclick="genTask('${t.recordId}')" style="padding:6px 16px; font-size:13px;">${t.status === '失败' ? '重试生成' : '开始生成'}</button>
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
    if (isProcessing) {
        updateFeishuStatus('⚠️ 正在处理其他任务，请稍候...', 'warning');
        return false;
    }

    isProcessing = true;
    const btn = document.getElementById('btn-' + id);
    const task = feishuTasks.find(t => t.recordId === id);
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
        const response = await fetch('/api/feishu/generate/' + id, {
            method: 'POST'
        });

        if (!response.ok) {
            const errorText = await response.text();
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'log') {
                            updateFeishuStatus(data.message, 'info');
                        } else if (data.type === 'stream') {
                            // 实时打字机效果显示上游反馈
                            streamTextContainer.textContent += data.content;
                            contentEl.scrollTop = contentEl.scrollHeight;
                        } else if (data.type === 'result') {
                            success = data.success;
                            resultData = data;
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        console.error('Parse error:', e);
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
