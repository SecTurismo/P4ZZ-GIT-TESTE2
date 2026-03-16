import { GoogleGenAI } from "@google/genai";
import { Product, Sale } from "../types";

const getApiKey = () => {
  if (typeof window !== 'undefined') {
    // 1. Prioridade máxima: Chave manual no localStorage (override temporário/desenvolvedor)
    const savedKey = localStorage.getItem('GEMINI_API_KEY_CONFIG');
    if (savedKey) return savedKey;

    // 2. Chave do Tenant atual (salva nas configurações do banco/localStorage)
    try {
      const userStr = localStorage.getItem('p4zz_session_user');
      const tenantId = userStr ? JSON.parse(userStr).tenantId : 'MASTER';
      
      const settingsKey = `p4zz_system_settings_${tenantId}`;
      const settingsStr = localStorage.getItem(settingsKey);
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        if (settings.geminiApiKey) return settings.geminiApiKey;
      }

      // 3. Fallback: Chave do MASTER (Global)
      if (tenantId !== 'MASTER') {
        const masterSettingsStr = localStorage.getItem('p4zz_system_settings_MASTER');
        if (masterSettingsStr) {
          const masterSettings = JSON.parse(masterSettingsStr);
          if (masterSettings.geminiApiKey) return masterSettings.geminiApiKey;
        }
      }
    } catch (e) {
      console.warn("Erro ao recuperar chave de API das configurações:", e);
    }
  }
  return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
};

export const getSalesInsights = async (sales: Sale[], products: Product[]) => {
  try {
    if (!sales.length) return "Realize algumas vendas para que eu possa analisar seu desempenho.";

    const summary = `
      Vendas Totais: ${sales.length}
      Receita Total: R$ ${sales.reduce((acc, s) => acc + s.total, 0).toFixed(2)}
      Produtos em Estoque: ${products.length}
    `;

    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Analise estes dados de vendas em PT-BR e dê 2 dicas rápidas e acionáveis para o dono do negócio: ${summary}`,
    });

    return response.text || "Sem insights no momento.";
  } catch (error: any) {
    console.warn("Gemini Sales Insights Error:", error);
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return "Cota diária de IA atingida. A análise retornará em breve.";
    }
    return "IA temporariamente indisponível para análise estratégica.";
  }
};

export const generateProductDescription = async (productName: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Crie uma descrição de marketing de apenas 1 frase curta para o produto: ${productName}`,
    });
    return response.text?.trim() || "";
  } catch (error) {
    return "";
  }
};

export const generateRealisticProductIcon = async (categoryName: string): Promise<string> => {
  const cleanName = categoryName.trim();
  
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Prompt dinâmico e mais descritivo
    // Se o nome for curto, tratamos como categoria. Se for longo, como descrição detalhada.
    const isDetailedDescription = cleanName.split(' ').length > 2;
    
    let subject = cleanName;
    if (!isDetailedDescription) {
      subject = `a professional presentation of ${cleanName}`;
    }

    const prompt = `Modern 3D premium illustration of ${subject}. 
    
    INTERPRETATION RULES:
    - If the product is a "Milkshake" (or any variation): must be a tall glass with creamy milkshake, whipped cream on top, and a straw. DO NOT use ice cream cones.
    - If the product is "Açaí" (or any variation): must be a purple bowl of açaí with visible texture, topped with granola or fruits. DO NOT use ice cream scoops.
    - If the product is "Ice Cream" (Sorvete): must be an ice cream scoop in a cone or a bowl with multiple scoops.
    - If the product is a "Burger": must show bun, meat patty, melted cheese, and fresh ingredients.
    - If the product is a "Pizza": must be a delicious slice of pizza with melted cheese and toppings.
    - Ensure the icon represents EXACTLY the product described. Avoid generic or confusing representations.
    - Focus on the key identifying features of the specific food or drink.
    
    STYLE: Semi-realistic digital art, high-quality 3D render, smooth surfaces, vibrant and saturated colors.
    DETAILS: Soft ambient occlusion shadows, clear depth and volume, professional studio lighting.
    PRESENTATION: Centered composition, filling the frame, isolated on a clean, minimalist, solid neutral light-grey background.
    VIBE: Professional, clean, and appetizing. Similar to high-end modern mobile app icons (Apple/Google style).
    QUALITY: 8k resolution, sharp edges, high contrast, macro view.
    STRICTLY NO: real photography, text, watermarks, people, hands, blurry backgrounds, or generic flat clip-art.`;

    console.log(`[AI Icon Gen] Prompt enviado: "${prompt}"`);

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    const candidates = response.candidates || [];
    if (candidates.length > 0) {
      for (const part of candidates[0].content?.parts || []) {
        if (part.inlineData?.data) {
          console.log(`[AI Icon Gen] Imagem gerada com sucesso para: "${cleanName}"`);
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data in response");
  } catch (error: any) {
    console.error(`[AI Icon Gen Error] Falha ao gerar para "${cleanName}":`, error);
    
    if (error.message?.includes('safety') || error.message?.includes('candidate')) {
      console.log("[AI Icon Gen] Tentando fallback simplificado...");
      try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const simplePrompt = `A modern, semi-realistic 3D illustration of ${cleanName}, vivid colors, soft shadows, minimalist background, high quality.`;
        const simpleResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: simplePrompt }],
          }
        });
        
        const part = simpleResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part?.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      } catch (innerError) {
        console.warn("[AI Icon Gen] Fallback falhou:", innerError);
      }
    }

    return await suggestCategoryIcon(categoryName);
  }
};

export const suggestCategoryIcon = async (categoryName: string): Promise<string> => {
  const cleanName = categoryName.trim().toUpperCase();
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const prompt = `
      Analyze the name of a restaurant/business category and choose the most representative icon from the list below.
      Return ONLY the name of the icon (exactly as written in the list).
      
      Available icons:
      Coffee, Beer, Pizza, IceCream, Cake, GlassWater, Wine, Soup, Beef, Cookie, Sandwich, Milk, Flame, Apple, Martini, Drumstick, Croissant, Egg, Fish, Popcorn, Salad, Shrimp, Candy, Donut, Bean, ChefHat, Plus, Lollipop, Cherry, Citrus, Grape.
      
      Rules:
      1. Be literal. If it's Sushi, choose Fish. If it's a Burger, choose Sandwich.
      2. Avoid generic icons like ChefHat or Plus if there's something more specific.
      3. For Açaí, use Grape or Cherry (closest colors) if IceCream is too confusing, but IceCream is the default for frozen desserts.
      4. For Drinks, use GlassWater, Beer, Wine, or Martini.
      5. For Meat/Steak, use Beef.
      
      Category Name: ${cleanName}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const suggestedIcon = response.text?.trim() || "ChefHat";
    // Validar se o ícone retornado está na nossa lista, senão usar ChefHat
    const validIcons = ["Coffee", "Beer", "Pizza", "IceCream", "Cake", "GlassWater", "Wine", "Soup", "Beef", "Cookie", "Sandwich", "Milk", "Flame", "Apple", "Martini", "Drumstick", "Croissant", "Egg", "Fish", "Popcorn", "Salad", "Shrimp", "Candy", "Donut", "Bean", "ChefHat", "Plus", "Lollipop", "Cherry", "Citrus", "Grape"];
    
    return validIcons.includes(suggestedIcon) ? suggestedIcon : "ChefHat";
  } catch (error) {
    console.warn("Gemini Icon Suggestion Error:", error);
    return "ChefHat";
  }
};
