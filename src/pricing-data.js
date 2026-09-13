export const PLANS = {
  start:  { label:"Cambio Start",   color:"var(--start)",   monthly:4,  activation:35,
    classes:{ S:{hour:2.35,night:0.5,day:28,  week:168,kmLow:0.41,kmHigh:0.32},
              M:{hour:2.95,night:0.5,day:35.5,week:213,kmLow:0.43,kmHigh:0.33},
              L:{hour:3.5, night:1,  day:40,  week:240,kmLow:0.45,kmHigh:0.35},
              XL:{hour:4.8,night:1,  day:58,  week:348,kmLow:0.51,kmHigh:0.38} } },
  bonus:  { label:"Cambio Bonus",   color:"var(--bonus)",   monthly:8,  activation:35,
    classes:{ S:{hour:2.10,night:0.5,day:25,  week:150,kmLow:0.32,kmHigh:0.30},
              M:{hour:2.45,night:0.5,day:29.5,week:177,kmLow:0.34,kmHigh:0.32},
              L:{hour:2.8, night:1,  day:32,  week:192,kmLow:0.38,kmHigh:0.33},
              XL:{hour:4.1,night:1,  day:49.5,week:297,kmLow:0.45,kmHigh:0.36} } },
  comfort:{ label:"Cambio Comfort", color:"var(--comfort)", monthly:22, activation:35,
    classes:{ S:{hour:1.85,night:0.5,day:22,week:132,kmLow:0.29,kmHigh:0.26},
              M:{hour:2.25,night:0.5,day:27,week:162,kmLow:0.31,kmHigh:0.27},
              L:{hour:2.50,night:1,  day:29,week:174,kmLow:0.32,kmHigh:0.28},
              XL:{hour:3.3,night:1,  day:40,week:240,kmLow:0.38,kmHigh:0.32} } },
  kbc:    { label:"KBC Mobile",     color:"var(--kbc)",     monthly:0,  activation:20,
    classes:{ S:{hour:3.35,kmLow:0.40,kmHigh:0.31},
              M:{hour:3.95,kmLow:0.42,kmHigh:0.32},
              L:{hour:4.50,kmLow:0.44,kmHigh:0.34} } }
};

export const SOURCES = {
  cambio: "https://www.cambio.be/en-bxl/how-much-does-it-cost",
  kbc: "https://www.kbc.be/retail/en/products/payments/self-banking/on-your-smartphone/mobile/cambio.html"
};
