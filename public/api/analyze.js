import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { images, propertyType, dlpStatus } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: '请上传至少一张缺陷照片' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '服务器未配置 API Key' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
    你是一位马来西亚资深房屋检验师与 Strata 房产管理法律专家。
    请分析上传的 (${images.length}) 张房屋缺陷图片，用极其温和、接地气、大众一听就懂的通俗语言回答。

    背景条件：
    - 房屋类型：${propertyType || 'High-rise'}
    - 保修状态：${dlpStatus || 'Post-DLP'}

    归责核心规则（非常重要）：
    你只能将责任方判定为以下两者之一：
    1. "业主自己 (Unit Owner)"
    2. "物业/管理处 (Management / JMB / MC)"

    请严格返回 JSON 格式（不要包含 markdown 代码块标记）：
    {
      "responsibleParty": "业主自己 (Unit Owner) 或 物业/管理处 (Management)",
      "defectName": "缺陷名称与简短现状描述",
      "reason": "为什么是他负责？用生活常识解释成因与责任（比如：如果是楼上漏水到楼下，根据法令默认是楼上业主的责任；如果是外墙裂缝水渗入，则是物业管理处负责）",
      "legalBasis": "依据的马来西亚法令通俗解释（如：Strata Management Act 2013 Form 28 / Inter-floor Leakage Clause）",
      "actionPlan": "建议使用者下一步怎么做（语气要实用、有建设性，指导如何发信件或沟通）"
    }
    `;

    const parts = [{ text: prompt }];
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.base64.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts }]
    });

    let rawText = response.text.trim();
    rawText = rawText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    const resultJson = JSON.parse(rawText);
    return res.status(200).json({ success: true, data: resultJson });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'AI 识别遇到一点小状况，请确保图片清晰后重试。' 
    });
  }
}
