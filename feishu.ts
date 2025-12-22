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
    }

    // 检查配置是否完整
    isConfigured(): boolean {
        return !!(this.appId && this.appSecret && this.appToken && this.tableId);
    }

    // 获取 tenant_access_token
    async getTenantAccessToken(): Promise<string> {
        // 如果 token 还有效，直接返回
        if (this.accessToken && Date.now() < this.tokenExpireTime) {
            return this.accessToken;
        }

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

        if (data.code !== 0) {
            throw new Error(`获取飞书 token 失败: ${data.msg}`);
        }

        this.accessToken = data.tenant_access_token;
        // token 有效期 2 小时，提前 5 分钟刷新
        this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000;

        return this.accessToken;
    }

    // 获取待生成的任务列表
    async getPendingTasks(limit: number = 100): Promise<any[]> {
        const token = await this.getTenantAccessToken();

        // 构建过滤条件：生成状态 = "待生成"
        const filter = {
            conjunction: "and",
            conditions: [
                {
                    field_name: "生成状态",
                    operator: "is",
                    value: ["待生成"],
                },
            ],
        };

        const response = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records/search`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    filter: filter,
                    page_size: limit,
                }),
            }
        );

        const data = await response.json();

        if (data.code !== 0) {
            throw new Error(`获取任务列表失败: ${data.msg}`);
        }

        return data.data.items || [];
    }

    // 获取单个任务
    async getTask(recordId: string): Promise<any> {
        const token = await this.getTenantAccessToken();

        const response = await fetch(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records/${recordId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            }
        );

        const data = await response.json();

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
    } {
        return {
            recordId: record.record_id,
            prompt: record.fields["提示词"] || "",
            character: record.fields["角色"] || undefined,
            model: record.fields["模型"] || "sora-video-landscape-10s",
            status: record.fields["生成状态"] || "待生成",
        };
    }
}
