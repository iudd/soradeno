// Feishu Frontend - 飞书批量生成前端逻辑
let feishuTasks = [];

function updateFeishuStatus(msg, type) {
    let el = document.getElementById('feishuLog');
    if (!el) {
        const list = document.getElementById('feishuTaskList');
        el = document.createElement('div');
        el.id = 'feishuLog';
        el.style.cssText = 'background:#0f172a;border-radius:8px;padding:12px;margin-bottom:12px;border-left:4px solid #6366f1;max-height:200px;overflow-y:auto;';
        list.parentNode.insertBefore(el, list);
    }
    const colors = {info:'#6366f1',success:'#10b981',error:'#ef4444',warning:'#f59e0b'};
    el.style.borderLeftColor = colors[type] || colors.info;
    el.style.display = 'block';
    const time = new Date().toLocaleTimeString('zh-CN');
    el.innerHTML = `<div style="font-size:13px;color:#94a3b8;">[${time}] ${msg}</div>` + el.innerHTML;
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
                const p = t.prompt.length > 60 ? t.prompt.slice(0,60)+'...' : t.prompt;
                html += `<div class="history-item" id="task-${t.recordId}" style="margin-bottom:8px;">
                    <div style="flex:1;"><div style="font-weight:500;">${p}</div>
                    <div style="font-size:12px;color:#94a3b8;">🎬 ${t.model}</div></div>
                    <button class="btn btn-primary" id="btn-${t.recordId}" onclick="genTask('${t.recordId}')" style="padding:6px 12px;font-size:13px;">生成</button>
                </div>`;
            });
        }
        
        if (done.length > 0) {
            html += '<h4 style="color:#10b981;margin:16px 0 8px;">✅ 已完成</h4>';
            done.slice(0,5).forEach(t => {
                const p = t.prompt ? (t.prompt.length > 60 ? t.prompt.slice(0,60)+'...' : t.prompt) : '(无)';
                html += `<div class="history-item" style="margin-bottom:8px;border-color:#10b981;">
                    <div style="flex:1;"><div style="font-weight:500;">${p}</div>
                    <div style="font-size:12px;color:#94a3b8;">✅ ${t.status}</div></div>
                    ${t.videoUrl ? `<a href="${t.videoUrl}" target="_blank" class="btn btn-secondary" style="padding:6px 12px;font-size:13px;">播放</a>` : ''}
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
    const btn = document.getElementById('btn-' + id);
    const task = feishuTasks.find(t => t.recordId === id);
    if (btn) { btn.disabled = true; btn.innerHTML = '...'; }
    updateFeishuStatus(`开始生成: ${task ? task.prompt.slice(0,30) : id}...`, 'info');
    
    try {
        const res = await fetch('/api/feishu/generate/' + id, {method:'POST'});
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        updateFeishuStatus('✅ 生成成功! 已同步到飞书', 'success');
        if (data.videoUrl) updateFeishuStatus('🔗 ' + data.videoUrl, 'success');
        if (btn) { btn.innerHTML = '✅'; btn.style.background = '#10b981'; }
    } catch (e) {
        updateFeishuStatus('❌ 失败: ' + e.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '重试'; btn.style.background = '#ef4444'; }
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
        updateFeishuStatus(`[${i+1}/${tasks.length}] 生成中...`, 'info');
        try {
            const res = await fetch('/api/feishu/generate/' + tasks[i].recordId, {method:'POST'});
            if (res.ok) { ok++; updateFeishuStatus(`[${i+1}] ✅ 成功`, 'success'); }
            else { fail++; updateFeishuStatus(`[${i+1}] ❌ 失败`, 'error'); }
        } catch (e) { fail++; }
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
