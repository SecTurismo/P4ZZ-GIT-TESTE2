import { Sale, Product, Addon, AIPrediction, AISettings } from '../types';

export const analyzeMovement = (sales: Sale[]): AIPrediction[] => {
  if (sales.length < 5) return [];

  const predictions: AIPrediction[] = [];
  const now = new Date();
  const currentDay = now.getDay(); // 0-6 (Dom-Sab)
  const currentHour = now.getHours();

  // Agrupar vendas por dia da semana e hora
  const movementMap: Record<number, Record<number, number>> = {};
  
  sales.forEach(sale => {
    const d = new Date(sale.date);
    const day = d.getDay();
    const hour = d.getHours();
    
    if (!movementMap[day]) movementMap[day] = {};
    if (!movementMap[day][hour]) movementMap[day][hour] = 0;
    movementMap[day][hour]++;
  });

  // Analisar o dia atual para as próximas 3 horas
  const todayMovement = movementMap[currentDay] || {};
  const nextHours = [currentHour + 1, currentHour + 2, currentHour + 3];
  
  let peakHour = -1;
  let maxSales = 0;

  nextHours.forEach(h => {
    const hour = h % 24;
    if (todayMovement[hour] > maxSales) {
      maxSales = todayMovement[hour];
      peakHour = hour;
    }
  });

  // Se houver um pico identificado (mais de 2 vendas históricas nesse horário)
  if (peakHour !== -1 && maxSales >= 2) {
    predictions.push({
      type: 'movement',
      title: 'Previsão de Movimento',
      message: `Hoje às ${peakHour}h pode haver aumento de fluxo de clientes.`,
      suggestion: 'Prepare estoque e equipe para maior movimento.',
      confidence: 0.8,
      data: { hour: peakHour }
    });
  }

  // Analisar padrões semanais (ex: Sextas à noite)
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  Object.entries(movementMap).forEach(([dayStr, hours]) => {
    const day = parseInt(dayStr);
    const dayTotal = Object.values(hours).reduce((a, b) => a + b, 0);
    
    // Se um dia tem muito mais movimento que a média
    const avgMovement = sales.length / 7;
    if (dayTotal > avgMovement * 1.5) {
      // Se for o dia de amanhã
      if (day === (currentDay + 1) % 7) {
        predictions.push({
          type: 'movement',
          title: 'Padrão Semanal Identificado',
          message: `Historicamente, ${daysOfWeek[day]}s têm um volume de vendas 50% maior.`,
          suggestion: `Reforce a equipe para amanhã (${daysOfWeek[day]}).`,
          confidence: 0.9
        });
      }
    }
  });

  return predictions;
};

export const analyzeStock = (products: Product[], sales: Sale[], addons: Addon[]): AIPrediction[] => {
  const predictions: AIPrediction[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Calcular consumo médio diário dos últimos 30 dias
  const recentSales = sales.filter(s => new Date(s.date) >= thirtyDaysAgo);
  const daysDiff = Math.max(1, (now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));

  const productConsumption: Record<string, number> = {};
  recentSales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productConsumption[item.productId]) productConsumption[item.productId] = 0;
      productConsumption[item.productId] += item.quantity;
    });
  });

  // Analisar Produtos
  products.forEach(product => {
    if (!product.active) return;
    
    const totalSold = productConsumption[product.id] || 0;
    const avgDaily = totalSold / daysDiff;

    if (avgDaily > 0) {
      const daysLeft = product.stock / avgDaily;
      
      if (daysLeft <= 3) {
        predictions.push({
          type: 'stock',
          title: `Alerta de Reposição: ${product.name}`,
          message: `Estoque atual: ${product.stock} un. Consumo médio: ${avgDaily.toFixed(1)} un/dia.`,
          suggestion: `O estoque deve acabar em aproximadamente ${Math.ceil(daysLeft)} dias. Realize a reposição.`,
          confidence: 0.85,
          data: { productId: product.id, daysLeft }
        });
      }
    } else if (product.stock < 5) {
      // Fallback para estoque baixo sem histórico de vendas recente
      predictions.push({
        type: 'stock',
        title: `Estoque Baixo: ${product.name}`,
        message: `O produto ${product.name} está com apenas ${product.stock} unidades.`,
        suggestion: 'Considere repor este item em breve.',
        confidence: 0.6
      });
    }
  });

  // Analisar Complementos (Addons)
  addons.forEach(addon => {
    // Estimar consumo de addons baseado nas vendas dos produtos vinculados
    let estimatedDailyAddonConsumption = 0;
    addon.linkedProducts.forEach(link => {
      const productAvgDaily = (productConsumption[link.productId] || 0) / daysDiff;
      estimatedDailyAddonConsumption += productAvgDaily * link.usagePerSale;
    });

    if (estimatedDailyAddonConsumption > 0) {
      const daysLeft = addon.totalQuantity / estimatedDailyAddonConsumption;
      if (daysLeft <= 3) {
        predictions.push({
          type: 'stock',
          title: `Alerta de Complemento: ${addon.name}`,
          message: `Estoque: ${addon.totalQuantity} ${addon.unit}. Consumo est.: ${estimatedDailyAddonConsumption.toFixed(1)}/dia.`,
          suggestion: `Previsão de esgotamento em ${Math.ceil(daysLeft)} dias.`,
          confidence: 0.8
        });
      }
    } else if (addon.totalQuantity < 10) {
        predictions.push({
            type: 'stock',
            title: `Complemento Baixo: ${addon.name}`,
            message: `Restam apenas ${addon.totalQuantity} ${addon.unit}.`,
            suggestion: 'Verifique a necessidade de reposição.',
            confidence: 0.5
        });
    }
  });

  return predictions;
};

export const getAIPredictions = (
  settings: AISettings | undefined,
  products: Product[],
  sales: Sale[],
  addons: Addon[]
): AIPrediction[] => {
  if (!settings || !settings.enabled) return [];

  let allPredictions: AIPrediction[] = [];

  if (settings.movementPredictionEnabled) {
    allPredictions = [...allPredictions, ...analyzeMovement(sales)];
  }

  if (settings.stockPredictionEnabled) {
    allPredictions = [...allPredictions, ...analyzeStock(products, sales, addons)];
  }

  // Adicionar recomendações gerais se houver poucos dados
  if (sales.length < (settings.minSalesForAnalysis || 5)) {
    allPredictions.push({
      type: 'recommendation',
      title: 'IA em Aprendizado',
      message: 'Ainda não tenho dados suficientes para gerar previsões precisas.',
      suggestion: 'Continue registrando suas vendas para que eu possa aprender os padrões do seu negócio.',
      confidence: 1
    });
  }

  return allPredictions;
};
