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

    // 获取配置详情（用于调试，不暴露敏感信息）
    getConfigStatus(): object {
        return {
            appIdSet: !!this.appId,
            appSecretSet: !!this.appSecret,
            appTokenSet: !!this.appToken,
            tableIdSet: !!this.tableId,
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
            console.error("[Feishu] 获取 token 失败:", data.msg);
            throw new Error(`获取飞书 token 失败: ${data.msg}`);
        }

        this.accessToken = data.tenant_access_token;
        // token 有效期 2 小时，提前 5 分钟刷新
        this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000;

        console.log("[Feishu] Token 获取成功");
        return this.accessToken;
    }

    // 获取所有记录
    async getAllRecords(limit: number = 100): Promise<any[]> {
        const token = await this.getTenantAccessToken();

        const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${this.appToken}/tables/${this.tableId}/records?page_size=${limit}`;
        console.log("[Feishu] 获取所有记录");

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.code !== 0) {
            console.error("[Feishu] 获取记录失败:", data.msg, "code:", data.code);
            throw new Error(`获取记录失败: ${data.msg}`);
        }

        const items = data.data?.items || [];
        console.log(`[Feishu] 获取到 ${items.length} 条记录`);

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
        console.log("[Feishu] 获取待生成任务");

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

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.code !== 0) {
            throw new Error(`获取任务失败: ${data.msg}`);
        }

        return data.data.record;
    }

    // 获取Sora图片的URL
    async getSoraImageUrl(soraImageToken: string): Promise<string> {
        if (!soraImageToken) {
            throw new Error("缺少图片token");
        }

        const token = await this.getTenantAccessToken();

        const url = `https://open.feishu.cn/open-apis/drive/v1/files/${soraImageToken}/download`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });

        const data = await response.json();

        if (data.code !== 0) {
            throw new Error(`获取图片URL失败: ${data.msg}`);
        }

        return data.data.download_url || data.data.url;
    }

    // 更新任务状态
    async updateTaskStatus(
        recordId: string,
        status: string,
        videoUrl?: string,
        imageUrl?: string,
        error?: string,
        watermarkFreeUrl?: string,
        googleDriveUrl?: string
    ): Promise<void> {
        const token = await this.getTenantAccessToken();

        const fields: any = {
            "生成状态": status,
            "是否已生成": status === "成功",
        };

        if (status === "成功") {
            // 优先使用 Google Drive URL 填充视频URL字段
            if (googleDriveUrl) {
                fields["视频URL"] = {
                    link: googleDriveUrl,
                    text: "查看视频",
                };
            } else if (videoUrl) {
                fields["视频URL"] = {
                    link: videoUrl,
                    text: "查看视频",
                };
            }

            // 如果有无水印URL，填充到专门的字段
            if (watermarkFreeUrl) {
                fields["无水印视频URL"] = {
                    link: watermarkFreeUrl,
                    text: "无水印视频",
                };
            }

            if (imageUrl) {
                fields["图片URL"] = {
                    link: imageUrl,
                    text: "查看图片",
                };
            }
            // 使用飞书API期望的Unix时间戳格式 (毫秒)
            fields["生成时间"] = Date.now();
        }

        if (status === "失败" && error) {
            fields["错误信息"] = error;
        }

        console.log("[Feishu] 更新任务状态:", { recordId, status, fields });

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
            console.error("[Feishu] 更新任务失败详情:", data);
            throw new Error(`更新任务状态失败: ${data.msg}`);
        }
    }

    // 解析模型名称，提取实际的模型ID
    private parseModelName(modelField: any): string {
        if (!modelField) {
            return "sora-video-portrait-10s";
        }

        const modelStr = String(modelField);

        // 如果包含括号说明，提取前面的模型ID
        // 例如: "sora-video-portrait-10s（竖屏10秒）" -> "sora-video-portrait-10s"
        const match = modelStr.match(/^(sora-[a-z0-9-]+)/i);
        if (match) {
            return match[1];
        }

        return modelStr;
    }

    // 解析任务记录
    parseTaskRecord(record: any): {
        recordId: string;
        prompt: string;
        character?: string;
        model: string;
        modelDisplay: string;
        generationType: string;
        soraImage?: string;
        status: string;
        isGenerated: boolean;
        createdTime?: string;
        videoUrl?: string;
        watermarkFreeUrl?: string;
        imageUrl?: string;
        error?: string;
    } {
        const fields = record.fields || {};

        // 获取提示词，确保是字符串
        let prompt = "";
        if (fields["提示词"]) {
            if (typeof fields["提示词"] === "string") {
                prompt = fields["提示词"];
            } else if (Array.isArray(fields["提示词"])) {
                // 飞书多行文本可能是数组
                prompt = fields["提示词"].map((item: any) =>
                    typeof item === "string" ? item : (item.text || "")
                ).join("");
            } else if (typeof fields["提示词"] === "object" && fields["提示词"].text) {
                prompt = fields["提示词"].text;
            }
        }

        // 获取角色
        let character = undefined;
        if (fields["角色"]) {
            if (typeof fields["角色"] === "string") {
                character = fields["角色"];
            } else if (Array.isArray(fields["角色"])) {
                character = fields["角色"].map((item: any) =>
                    typeof item === "string" ? item : (item.text || "")
                ).join("");
            }
        }

        // 尝试获取视频URL
        let videoUrl = undefined;
        let watermarkFreeUrl = undefined;
        if (fields["视频URL"]) {
            if (typeof fields["视频URL"] === "string") {
                videoUrl = fields["视频URL"];
            } else if (fields["视频URL"].link) {
                videoUrl = fields["视频URL"].link;
            }
        }
        if (fields["无水印视频URL"]) {
            if (typeof fields["无水印视频URL"] === "string") {
                watermarkFreeUrl = fields["无水印视频URL"];
            } else if (fields["无水印视频URL"].link) {
                watermarkFreeUrl = fields["无水印视频URL"].link;
            }
        }

        // 尝试获取图片URL
        let imageUrl = undefined;
        if (fields["图片URL"]) {
            if (typeof fields["图片URL"] === "string") {
                imageUrl = fields["图片URL"];
            } else if (fields["图片URL"].link) {
                imageUrl = fields["图片URL"].link;
            }
        }

        // 尝试获取Sora图片
        let soraImage = undefined;
        if (fields["Sora图片"]) {
            if (typeof fields["Sora图片"] === "string") {
                soraImage = fields["Sora图片"];
            } else if (Array.isArray(fields["Sora图片"]) && fields["Sora图片"].length > 0) {
                const item = fields["Sora图片"][0];
                if (typeof item === "string") {
                    soraImage = item;
                } else if (item && item.url) {
                    soraImage = item.url;
                } else if (item && item.file_token) {
                    soraImage = item.file_token;
                }
            } else if (fields["Sora图片"].url) {
                soraImage = fields["Sora图片"].url;
            } else if (fields["Sora图片"].file_token) {
                soraImage = fields["Sora图片"].file_token;
            }
        }

        // 获取模型名称
        let modelDisplay = "sora-video-portrait-10s";
        if (fields["模型"]) {
            modelDisplay = typeof fields["模型"] === "string" ? fields["模型"] : (fields["模型"].text || String(fields["模型"]));
        }
        const model = this.parseModelName(modelDisplay);

        // 获取生成类型
        let generationType = "视频生成";
        if (fields["生成类型"]) {
            generationType = typeof fields["生成类型"] === "string" ? fields["生成类型"] : (fields["生成类型"].text || String(fields["生成类型"]));
        }

        // 获取生成状态
        let status = "待生成";
        if (fields["生成状态"]) {
            status = typeof fields["生成状态"] === "string" ? fields["生成状态"] : (fields["生成状态"].text || String(fields["生成状态"]));
        }

        return {
            recordId: record.record_id,
            prompt: prompt,
            character: character,
            model: model,
            modelDisplay: modelDisplay,
            generationType: generationType,
            soraImage: soraImage,
            status: status,
            isGenerated: fields["是否已生成"] || false,
            createdTime: fields["生成时间"] ? new Date(fields["生成时间"]).toLocaleString("zh-CN") : undefined,
            videoUrl: videoUrl,
            watermarkFreeUrl: watermarkFreeUrl,
            imageUrl: imageUrl,
            error: fields["错误信息"] || "",
        };
    }
}
