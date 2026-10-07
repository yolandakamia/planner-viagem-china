/* First-run content of the Mala tab (created once, by migration v2 —
   everything here can be edited or deleted and will not come back).
   Weights are rough estimates in grams, per unit. */
import type { Mala } from "./tipos";

export const MALAS_PADRAO: (Omit<Mala, "id"> & { chave: string })[] = [
  { chave: "despachada", nome: "Mala despachada", tipo: "despachada", limiteKg: 23, ordem: 0, trecho: "ambos" },
  { chave: "mao",        nome: "Mala de mão",     tipo: "mao",        limiteKg: 7,  ordem: 1, trecho: "ambos" },
  { chave: "mochila",    nome: "Mochila",         tipo: "mochila",    limiteKg: null, ordem: 2, trecho: "ambos" },
];

type Sug = [nome: string, categoria: string, subcategoria: string, quantidade: number, pesoG: number | null,
  mala: "despachada" | "mao" | "mochila", obs: string, soMao?: boolean, estilo?: string];

export const ITENS_SUGERIDOS: Sug[] = [
  // documents — in the backpack, never checked
  ["Passaporte (validade de 6 meses ou mais)", "documento", "", 1, 50, "mochila", "Conferir também visto ou regra de isenção vigente para brasileiros.", true],
  ["Cópias do passaporte e do visto", "documento", "", 2, 20, "mochila", "Uma cópia na mochila e outra na mala despachada. Foto no celular também.", false],
  ["Reservas de hotel impressas com endereço em chinês", "documento", "", 1, 30, "mochila", "Taxistas não leem endereço em inglês.", false],
  ["Seguro viagem (apólice impressa)", "documento", "", 1, 20, "mochila", "", false],
  ["Cartão de crédito internacional + algum dinheiro em yuan", "documento", "", 1, 50, "mochila", "Na China quase tudo é Alipay/WeChat Pay: deixar o Alipay com cartão estrangeiro configurado antes.", true],
  ["Credencial / pré-registro da CIIF", "documento", "", 1, 10, "mochila", "Impressa ou no celular.", false],

  // electronics
  ["Adaptador de tomada (tipos A, C e I)", "eletronico", "", 2, 80, "mochila", "Tomadas da China: A, C e I. Levar um por pessoa, de preferência universal.", false],
  ["Power bank (até 20.000 mAh / 100 Wh)", "eletronico", "", 1, 350, "mochila", "Só na bagagem de mão, nunca despachado. Em voos domésticos na China, verificar a exigência do selo CCC (3C) no power bank: sem ele pode ser retido no embarque.", true],
  ["Carregadores e cabos do celular", "eletronico", "", 1, 150, "mochila", "", false],
  ["Notebook + carregador", "eletronico", "", 1, 2000, "mochila", "Na bagagem de mão (bateria de lítio).", true],
  ["Chip / eSIM com dados e VPN instalada e testada", "eletronico", "", 1, null, "mochila", "Google, WhatsApp e Instagram são bloqueados na China. Instalar e testar a VPN antes de sair do Brasil.", false],
  ["Fone de ouvido", "eletronico", "", 1, 50, "mochila", "", false],

  // work
  ["Cartões de visita (com verso em chinês, se possível)", "trabalho", "", 200, 2, "mochila", "Entregar e receber com as duas mãos. Na feira acabam rápido: levar bastante.", false],
  ["Catálogos / apresentação da empresa", "trabalho", "", 10, 150, "despachada", "", false],
  ["Caderno e canetas", "trabalho", "", 1, 300, "mochila", "", false],

  // clothes — layers: Shanghai ~15–24 °C, Shenzhen ~22–29 °C and humid in October
  ["Camisa social", "roupa", "camisa", 5, 200, "despachada", "", false, "social"],
  ["Camiseta", "roupa", "camiseta", 4, 150, "despachada", "", false, "casual"],
  ["Calça social", "roupa", "calça", 3, 450, "despachada", "", false, "social"],
  ["Calça casual / jeans", "roupa", "calça", 1, 600, "despachada", "", false, "casual"],
  ["Blazer", "roupa", "blazer", 1, 800, "mao","Na mala de mão, para não amassar.", false, "social"],
  ["Agasalho leve / malha (camadas para clima variado)", "roupa", "agasalho", 1, 400, "despachada", "Ar-condicionado forte nos pavilhões e manhãs mais frescas em Shanghai.", false, "casual"],
  ["Casaco corta-vento / capa de chuva", "roupa", "agasalho", 1, 350, "despachada", "Outubro ainda pode ter chuva no sul da China.", false, "casual"],
  ["Roupa íntima", "roupa", "roupa íntima", 8, 60, "despachada", "", false],
  ["Meias", "roupa", "meias", 8, 50, "despachada", "Meias confortáveis para os dias de feira.", false],
  ["Pijama", "roupa", "pijama", 1, 300, "despachada", "", false],
  ["Cinto", "roupa", "acessório", 1, 150, "despachada", "", false, "social"],
  ["Guarda-chuva compacto", "outros", "", 1, 300, "mochila", "", false],

  // shoes
  ["Calçado confortável para a feira", "calcado", "tênis", 1, 800, "despachada", "São dias inteiros andando nos pavilhões do NECC. Já amaciado, nunca novo.", false, "casual"],
  ["Sapato social", "calcado", "sapato", 1, 900, "despachada", "", false, "social"],

  // hygiene
  ["Nécessaire (escova, pasta, desodorante…)", "higiene", "", 1, 700, "despachada", "Líquidos na mala de mão: até 100 ml por frasco.", false],
  ["Remédios de uso pessoal + receita", "higiene", "", 1, 200, "mochila", "Na bagagem de mão, com a receita.", true],
  ["Lenços de papel de bolso", "higiene", "", 4, 30, "mochila", "Muitos banheiros públicos na China não têm papel.", false],
  ["Álcool em gel (até 100 ml)", "higiene", "", 1, 100, "mochila", "", false],
  ["Máscaras", "higiene", "", 5, 5, "mochila", "Para dias de poluição ou trem lotado.", false],
];
