import React from 'react';
import { 
  Coffee, 
  Beer, 
  Utensils, 
  Pizza, 
  IceCream, 
  Cake, 
  GlassWater, 
  Wine, 
  Soup, 
  Beef, 
  Cookie,
  Sandwich,
  Milk,
  Flame,
  Apple,
  Cherry,
  Citrus,
  Grape,
  Martini,
  Drumstick,
  Croissant,
  Egg,
  Fish,
  Lollipop,
  Popcorn,
  Salad,
  Sandwich as BurgerIcon,
  Plus,
  Shrimp,
  Candy,
  Donut,
  Bean,
  ChefHat
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  Coffee: <Coffee className="w-full h-full" />,
  Beer: <Beer className="w-full h-full" />,
  Pizza: <Pizza className="w-full h-full" />,
  IceCream: <IceCream className="w-full h-full" />,
  Cake: <Cake className="w-full h-full" />,
  GlassWater: <GlassWater className="w-full h-full" />,
  Wine: <Wine className="w-full h-full" />,
  Soup: <Soup className="w-full h-full" />,
  Beef: <Beef className="w-full h-full" />,
  Cookie: <Cookie className="w-full h-full" />,
  Sandwich: <BurgerIcon className="w-full h-full" />,
  Milk: <Milk className="w-full h-full" />,
  Flame: <Flame className="w-full h-full" />,
  Apple: <Apple className="w-full h-full" />,
  Martini: <Martini className="w-full h-full" />,
  Drumstick: <Drumstick className="w-full h-full" />,
  Croissant: <Croissant className="w-full h-full" />,
  Egg: <Egg className="w-full h-full" />,
  Fish: <Fish className="w-full h-full" />,
  Popcorn: <Popcorn className="w-full h-full" />,
  Salad: <Salad className="w-full h-full" />,
  Shrimp: <Shrimp className="w-full h-full" />,
  Candy: <Candy className="w-full h-full" />,
  Donut: <Donut className="w-full h-full" />,
  Bean: <Bean className="w-full h-full" />,
  ChefHat: <ChefHat className="w-full h-full" />,
  Plus: <Plus className="w-full h-full" />,
  Lollipop: <Lollipop className="w-full h-full" />,
  Cherry: <Cherry className="w-full h-full" />,
  Citrus: <Citrus className="w-full h-full" />,
  Grape: <Grape className="w-full h-full" />,
};

export const getCategoryIcon = (name: string, iconName?: string) => {
  // If we have a stored icon name from AI, use it
  if (iconName) {
    // Check if it's a base64 image
    if (iconName.startsWith('data:image')) {
      return (
        <img 
          src={iconName} 
          alt={name} 
          className="w-full h-full object-cover rounded-md" 
          referrerPolicy="no-referrer"
        />
      );
    }
    
    if (ICON_MAP[iconName]) {
      return ICON_MAP[iconName];
    }
  }

  const n = name.toLowerCase();
  
  // Bebidas
  if (n.includes('café') || n.includes('cafe') || n.includes('cappuccino') || n.includes('expresso')) return <Coffee className="w-full h-full" />;
  if (n.includes('suco') || n.includes('natural') || n.includes('vitamina')) return <GlassWater className="w-full h-full" />;
  if (n.includes('refrigerante') || n.includes('água') || n.includes('agua') || n.includes('soda')) return <GlassWater className="w-full h-full" />;
  if (n.includes('cerveja') || n.includes('chopp') || n.includes('balde')) return <Beer className="w-full h-full" />;
  if (n.includes('vinho') || n.includes('adega')) return <Wine className="w-full h-full" />;
  if (n.includes('cachaça') || n.includes('cachaca') || n.includes('drink') || n.includes('coquetel') || n.includes('gin') || n.includes('vodka')) return <Martini className="w-full h-full" />;
  if (n.includes('milkshake') || n.includes('milk shake') || n.includes('batido')) return <Milk className="w-full h-full" />;

  // Comidas Principais
  if (n.includes('sanduíche') || n.includes('sanduiche') || n.includes('hambúrguer') || n.includes('hamburguer') || n.includes('burger') || n.includes('lanche') || n.includes('artesanal')) return <BurgerIcon className="w-full h-full" />;
  if (n.includes('pizza') || n.includes('calzone')) return <Pizza className="w-full h-full" />;
  if (n.includes('sushi') || n.includes('temaki') || n.includes('sashimi') || n.includes('japa') || n.includes('oriental')) return <Fish className="w-full h-full" />;
  if (n.includes('peixe') || n.includes('frutos do mar') || n.includes('camarão') || n.includes('camarao')) return <Shrimp className="w-full h-full" />;
  if (n.includes('carne') || n.includes('churrasco') || n.includes('bife') || n.includes('picanha') || n.includes('grelhado')) return <Beef className="w-full h-full" />;
  if (n.includes('massa') || n.includes('macarrão') || n.includes('macarrao') || n.includes('pasta') || n.includes('lasanha')) return <Soup className="w-full h-full" />;
  if (n.includes('salada') || n.includes('saudável') || n.includes('saudavel') || n.includes('fit')) return <Salad className="w-full h-full" />;
  if (n.includes('sopa') || n.includes('caldo')) return <Soup className="w-full h-full" />;

  // Porções e Salgados
  if (n.includes('porção') || n.includes('porcao') || n.includes('petisco') || n.includes('entrada') || n.includes('frito')) return <Drumstick className="w-full h-full" />;
  if (n.includes('salgado') || n.includes('coxinha') || n.includes('pastel') || n.includes('empada') || n.includes('quibe')) return <Croissant className="w-full h-full" />;
  if (n.includes('pão') || n.includes('pao') || n.includes('padaria') || n.includes('baguete')) return <Croissant className="w-full h-full" />;
  if (n.includes('ovo') || n.includes('omelete')) return <Egg className="w-full h-full" />;

  // Sobremesas e Doces
  if (n.includes('açaí') || n.includes('acai') || n.includes('tigela')) return <IceCream className="w-full h-full" />;
  if (n.includes('sorvete') || n.includes('gelato') || n.includes('picolé') || n.includes('picole')) return <IceCream className="w-full h-full" />;
  if (n.includes('sobremesa') || n.includes('doce') || n.includes('bolo') || n.includes('torta') || n.includes('pudim')) return <Cake className="w-full h-full" />;
  if (n.includes('donut') || n.includes('rosquinha')) return <Donut className="w-full h-full" />;
  if (n.includes('biscoito') || n.includes('bolacha') || n.includes('cookie')) return <Cookie className="w-full h-full" />;
  if (n.includes('bala') || n.includes('pirulito') || n.includes('chiclete')) return <Candy className="w-full h-full" />;
  if (n.includes('chocolate') || n.includes('bombom')) return <Candy className="w-full h-full" />;

  // Outros
  if (n.includes('fruta')) return <Apple className="w-full h-full" />;
  if (n.includes('pipoca')) return <Popcorn className="w-full h-full" />;
  if (n.includes('extra') || n.includes('adicional') || n.includes('complemento')) return <Plus className="w-full h-full" />;
  if (n.includes('quente') || n.includes('pimenta') || n.includes('picante')) return <Flame className="w-full h-full" />;
  if (n.includes('combo') || n.includes('promoção') || n.includes('promocao')) return <Flame className="w-full h-full" />;
  
  return <ChefHat className="w-full h-full" />;
};
