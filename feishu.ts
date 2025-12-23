// Feishu API Service
// 飞书多维表格集成服务

export class FeishuService {
    private appId: string;
    private appSecret: string;
    private appToken: string;
    private tableId: string;
    private accessToken: string | null = null;
    private tokenExpireTime: number = 0;

    constructor() {
        this.appId = Deno.env.get("FEISHU_APP_ID") || "";
        this.appSecret = Deno.env.get("FEISHU_APP_SECRET") || "";
        this.appToken = Deno.env.get("FEISHU_APP_TOKEN") || "";
        this.tableId = Deno.env.get("FEISHU_TABLE_ID") || "";
        
        // 调试日志
        console.log("[Feishu] 配置信息:");
        console.log(`  - APP_ID: ${this.appId ? this.appId.slice(0, 10) + "..." : "未设置"}`);
        console.log(`  - APP_SECRET: ${this.appSecret ? "已设置" : "未设置"}`);
        console.log(`  - APP_TOKEN: ${this.appToken || "未设置"}`);
        console.log(`  - TABLE_ID: ${this.tableId || "未设置"}`);
    }

    // 检查配置是否完整
    isConfigured(): boolean {
        const configured = !!(this.appId && this.appSecret && this.appToken && this.tableId);
        console.log(`[Feishu] 配置检查: ${configured ? "完整" : "不完整"}`);
        return configured;
    }

    // 获取配置详情（用于调试）
    getConfigStatus(): object {
        return {
            appId: this.appId ? `${this.appId.slice(0, 10)}...` : null,
            appSecretSet: !!this.appSecret,
            appToken: this.appToken || null,
            tableId: this.tableId || null,
            isConfigured: this.isConfigured()
        };
    }

    // 获取 tenant_access_token
    async getTenantAccessToken(): Promise<string> {
        // 如果 token 还有效，直接返回
        if (this.accessToken && Date.now() < this.tokenExpireTime) {
            console.log("[Feishu] 使用缓存的 access_token");
            return this.accessToken;
        }

        console.log("[Feishu] 获取新的 tenant_access_token...");
        console.log(`[Feishu] 请求参数: app_id=${this.appId}`);

        const response = await fetch(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app_id: this.appId,
                    app_secret: this.appSecret,
                }),
            }
        );

        const data = await response.json();
        console.log("[Feishu] Token 响应:", JSON.stringify(data, null, 2));

        if (data.code !== 0) {
            console.error("[Feishu] 获取 token 失败:", data.msg);
            throw new Error(`获取飞书 token 失败: ${data.msg}`);
        }

        this.accessToken = data.tenant_access_token;
        // token 有效期 2 小时，提前 5 分钟刷新
        this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000;

        console.log("[Feishu] Token 获取成功");
        return this.accessToken;
    }

    // 获取所有记录（用于调试和显示）
    async getAllRecords(limit: number = 100): Promise<any[]> {
        const token = await this.getTenantAccessToken();

        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records?page_size=${limit}`;
        console.log("[Feishu] 获取所有记录, URL:", url);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();
        console.log("[Feishu] 获取记录响应:", JSON.stringify(data, null, 2));

        if (data.code !== 0) {
            console.error("[Feishu] 获取记录失败:", data.msg, "code:", data.code);
            throw new Error(`获取记录失败: ${data.msg}`);
        }

        const items = data.data?.items || [];
        console.log(`[Feishu] 获取到 ${items.length} 条记录`);
        
        // 打印每条记录的字段名
        if (items.length > 0) {
            console.log("[Feishu] 第一条记录的字段:", Object.keys(items[0].fields));
            console.log("[Feishu] 第一条记录内容:", JSON.stringify(items[0], null, 2));
        }

        return items;
    }

    // 获取待生成的任务列表
    async getPendingTasks(limit: number = 100): Promise<any[]> {
        const token = await this.getTenantAccessToken();

        // 构建过滤条件：是否已生成 = false 或 生成状态 = "待生成"
        const filter = {
            conjunction: "or",
            conditions: [
                {
                    field_name: "是否已生成",
                    operator: "is",
                    value: [false],
                },
                {
                    field_name: "生成状态",
                    operator: "is",
                    value: ["待生成"],
                },
            ],
        };

        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records/search`;
        console.log("[Feishu] 获取待生成任务, URL:", url);
        console.log("[Feishu] 过滤条件:", JSON.stringify(filter, null, 2));

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                filter: filter,
                page_size: limit,
            }),
        });

        const data = await response.json();
        console.log("[Feishu] 待生成任务响应:", JSON.stringify(data, null, 2));

        if (data.code !== 0) {
            console.error("[Feishu] 获取待生成任务失败:", data.msg, "code:", data.code);
            throw new Error(`获取任务列表失败: ${data.msg}`);
        }

        const items = data.data?.items || [];
        console.log(`[Feishu] 找到 ${items.length} 个待生成任务`);

        return items;
    }

    // 获取单个任务
    async getTask(recordId: string): Promise<any> {
        const token = await this.getTenantAccessToken();

        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records/${recordId}`;
        console.log("[Feishu] 获取单个任务, URL:", url);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();
        console.log("[Feishu] 单个任务响应:", JSON.stringify(data, null, 2));

        if (data.code !== 0) {
            throw new Error(`获取任务失败: ${data.msg}`);
        }

        return data.data.record;
    }

    // 更新任务状态
    async updateTaskStatus(
        recordId: string,
        status: string,
        videoUrl?: string,
        error?: string
    ): Promise<void> {
        const token = await this.getTenantAccessToken();

        const fields: any = {
            "生成状态": status,
            "是否已生成": status === "成功",
        };

        if (status === "成功" && videoUrl) {
            fields["视频URL"] = {
                link: videoUrl,
                text: "查看视频",
            };
            fields["生成时间"] = Date.now();
        }

        if (status === "失败" && error) {
            fields["错误信息"] = error;
        }

        console.log("[Feishu] 更新任务状态:", { recordId, fields });

        const response = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records/${recordId}`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fields: fields,
                }),
            }
        );

        const data = await response.json();
        console.log("[Feishu] 更新状态响应:", JSON.stringify(data, null, 2));

        if (data.code !== 0) {
            throw new Error(`更新任务状态失败: ${data.msg}`);
        }
    }

    // 批量更新任务状态
    async batchUpdateTasks(updates: Array<{
        recordId: string;
        status: string;
        videoUrl?: string;
        error?: string;
    }>): Promise<void> {
        const token = await this.getTenantAccessToken();

        const records = updates.map(update => {
            const fields: any = {
                "生成状态": update.status,
                "是否已生成": update.status === "成功",
            };

            if (update.status === "成功" && update.videoUrl) {
                fields["视频URL"] = {
                    link: update.videoUrl,
                    text: "查看视频",
                };
                fields["生成时间"] = Date.now();
            }

            if (update.status === "失败" && update.error) {
                fields["错误信息"] = update.error;
            }

            return {
                record_id: update.recordId,
                fields: fields,
            };
        });

        const response = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records/batch_update`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    records: records,
                }),
            }
        );

        const data = await response.json();

        if (data.code !== 0) {
            throw new Error(`批量更新任务失败: ${data.msg}`);
        }
    }

    // 解析任务记录
    parseTaskRecord(record: any): {
        recordId: string;
        prompt: string;
        character?: string;
        model: string;
        status: string;
        isGenerated: boolean;
        createdTime?: string;
        videoUrl?: string;
        rawFields: any;
    } {
        const fields = record.fields || {};
        
        // 尝试获取视频URL
        let videoUrl = undefined;
        if (fields["视频URL"]) {
            if (typeof fields["视频URL"] === "string") {
                videoUrl = fields["视频URL"];
            } else if (fields["视频URL"].link) {
                videoUrl = fields["视频URL"].link;
            }
        }

        return {
            recordId: record.record_id,
            prompt: fields["提示词"] || "",
            character: fields["角色"] || undefined,
            // 默认模型改为竖屏10秒
            model: fields["模型"] || "sora-video-portrait-10s",
            status: fields["生成状态"] || "待生成",
            isGenerated: fields["是否已生成"] || false,
            createdTime: fields["创建时间"] ? new Date(fields["创建时间"]).toLocaleString("zh-CN") : undefined,
            videoUrl: videoUrl,
            rawFields: fields, // 返回原始字段用于调试
        };
    }
}
