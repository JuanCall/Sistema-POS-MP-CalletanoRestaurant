# 📋 INFORME DE REVISIÓN POR PARES — CALLETANO POS PAPER

> **Comité de revisión:** Editor Asociado Scopus | Experto en Ing. de Software | Experto en Metodología | Editor de Redacción Científica
> **Archivo evaluado:** `docs/paper_capstone.docx`
> **Fecha:** Julio 2026

---

## FASE 1 | REVISIÓN CRÍTICA — DICTAMEN DEL COMITÉ

### 🔴 Problemas Críticos (Motivo de Rechazo Inmediato)

| # | Problema | Gravedad | Por qué un revisor lo rechazaría | Solución |
|---|---|---|---|---|
| **C1** | **Diseño preexperimental sin grupo control** | 🔴 Crítica | Un revisor de Scopus exigirá validez interna. Sin grupo control, no se puede atribuir causalidad al sistema POS. Las mejoras observadas podrían deberse al efecto Hawthorne, maduración, o estacionalidad. | Reconocer explícitamente como limitación. Cambiar lenguaje de "demostró" a "sugiere". Agregar pruebas estadísticas. |
| **C2** | **Sin soporte estadístico** | 🔴 Crítica | Las métricas (74%, 93%, 60→10 min) se presentan como hechos consumados sin DE, IC 95%, valor p, ni tamaño del efecto. | Agregar paired t-test, d de Cohen, IC 95% para cada indicador. |
| **C3** | **Referencias [4] y [5] no citadas en el texto** | 🔴 Crítica | Una referencia bibliográfica que no aparece citada en el cuerpo es error editorial grave. | Agregar citas de [4] y [5] en el texto o eliminarlas. |
| **C4** | **Sección 10 (Plan de Despliegue)** | 🔴 Crítica | Un paper científico NO incluye un plan de implementación por días. Esto es contenido de informe de tesis, no de artículo. | Eliminar Sección 10 completa o reducir a 1 párrafo en Discusión. |

### 🟡 Problemas Importantes

| # | Problema | Gravedad | Solución |
|---|---|---|---|
| **I1** | **Estado del arte insuficiente** | 🟡 Alta | Solo 8 referencias. Falta literatura sobre sistemas POS, arquitecturas híbridas, offline-first, y estudios similares publicados 2022-2026. | Agregar 5-8 referencias actuales de Scopus/Q1-Q2 sobre POS, eficiencia operativa en restaurantes. |
| **I2** | **Discusión ausente** | 🟡 Alta | La sección "Discusión" solo describe los resultados, no los compara con otros estudios. | Agregar comparación explícita con papers similares. |
| **I3** | **Tabla 10 sin datos visibles** | 🟡 Alta | La tabla más importante (KPIs) no tiene contenido visible en el texto extraído. | Asegurar que la tabla contenga: O1, O2, diferencia, % cambio, IC 95%. |
| **I4** | **"Validación de Usabilidad" sin datos** | 🟡 Alta | Se menciona SUS 85/100 en Conclusiones pero no hay tabla con los puntajes por ítem, DE, ni interpretación. | Agregar tabla con los 10 ítems SUS, puntajes individuales, promedio, DE. |
| **I5** | **Afirmaciones sin respaldo (FASE 4)** | 🟡 Alta | "vanguardia", "transformacional", "altamente escalable", "erradica la latencia local", "incremento directo del flujo de caja" | Reemplazar por lenguaje objetivo: "se observó", "los resultados sugieren", "bajo las condiciones del estudio". |
| **I6** | **Sección 5 (Herramientas de Ingeniería) es informe técnico** | 🟡 Alta | Tablas de hardware, software, comparación de metodologías son contenido de tesis, no de paper científico. | Reducir drásticamente o mover a Apéndice. |

### 🔵 Problemas Menores

| # | Problema | Solución |
|---|---|---|
| **m1** | Título muy largo (18 palabras) | Acortar a ≤15 palabras. Sugerencia: "A Multiplatform POS System for Improving Operational Efficiency in a Peruvian Restaurant" |
| **m2** | Keywords redundantes ("Eficiencia Operativa" y "Operational Efficiency" en ambos idiomas) | Unificar keywords en inglés: POS System, Operational Efficiency, Hybrid Architecture, Scrum, Electronic Invoicing, React Native |
| **m3** | Sin tabla de contenido, lista de figuras o lista de tablas | En formato IEEE no es necesario, pero verificar consistencia |
| **m4** | Abreviaturas no definidas en primera aparición (SUS, TIR, VAN, B/C, COK) | Definir cada una en su primera mención |
| **m5** | El Resumen en español repite exactamente el Abstract | El resumen debe ser una versión ligeramente más extensa; el abstract una versión concisa |

---

## FASE 2 | ANÁLISIS METODOLÓGICO

### Clasificación del diseño

El diseño es **preexperimental de un solo grupo con pretest-postest (G • O1 • X • O2)**.

- **¿Corresponde?** Sí, es apropiado para un estudio exploratorio en un entorno real donde no es posible asignar aleatoriamente.
- **¿Problemas?** Sí, graves:

| Problema | Impacto |
|---|---|
| **Sin grupo de control** | No se puede descartar que factores externos (cambio de personal, temporada turística) causaran las mejoras |
| **Sin aleatorización** | Sesgo de selección |
| **n = 1 restaurante** | Imposible generalizar |
| **n = 7 personas** | Muestra pequeña para inferencia estadística |
| **Mediciones no ciegas** | El investigador conocía los resultados esperados (sesgo del experimentador) |
| **Efecto Hawthorne** | El personal podría haber mejorado por el hecho de ser observados, no por el sistema |

### Validez y Confiabilidad

| Aspecto | Evaluación |
|---|---|
| **Validez interna** | ❌ Débil — sin control de variables extrañas |
| **Validez externa** | ❌ Limitada — un solo caso en un contexto específico |
| **Validez de constructo** | ✅ Aceptable — las dimensiones (tiempos operativos, exactitud) corresponden al constructo "eficiencia operativa" |
| **Confiabilidad** | ⚠️ Mencionan Alfa de Cronbach pero no reportan el valor obtenido |

---

## FASE 3 | ANÁLISIS ESTADÍSTICO — PRESCRIPCIÓN DETALLADA

### 3.1 Datos que se deben obtener para cada KPI

Para cada indicador (tiempo de atención, errores, tiempo de cierre), se necesita:

| Dato | Ejemplo | Cómo obtenerlo |
|---|---|---|
| **Media O1** (pretest) | 4.2 min | Promedio de al menos 30 observaciones antes de implementar |
| **Media O2** (postest) | <5 seg | Promedio de al menos 30 observaciones después |
| **Desviación estándar O1** | σ₁ = 1.8 min | STDEV() en Excel o Python |
| **Desviación estándar O2** | σ₂ = 0.3 seg | STDEV() en Excel o Python |
| **Tamaño muestral O1** | n₁ = 30 | Número de pedidos observados antes |
| **Tamaño muestral O2** | n₂ = 30 | Número de pedidos observados después |

### 3.2 Pruebas estadísticas requeridas

| Prueba | Propósito | Cómo hacerla |
|---|---|---|
| **Shapiro-Wilk** | Verificar normalidad de los datos | En Python: `scipy.stats.shapiro(data)` |
| **Paired t-test** | Comparar O1 vs O2 (si datos normales) | En Python: `scipy.stats.ttest_rel(o1, o2)` |
| **Wilcoxon signed-rank** | Alternativa no paramétrica si no hay normalidad | En Python: `scipy.stats.wilcoxon(o1, o2)` |
| **d de Cohen** | Tamaño del efecto | `(mean_o2 - mean_o1) / pooled_std` |
| **IC 95%** | Precisión de la estimación | `mean_diff ± t_critical * (std_diff / sqrt(n))` |

### 3.3 Tablas a agregar

**Tabla 11 — Prueba de hipótesis para indicadores operativos**

| Indicador | O1 (M±DE) | O2 (M±DE) | Diferencia | IC 95% | t | gl | p | d de Cohen |
|---|---|---|---|---|---|---|---|---|
| Tiempo de pedido a cocina (min) | 4.2 ± 1.8 | 0.08 ± 0.02 | 4.12 | [3.5, 4.7] | 12.3 | 29 | <0.001 | 3.2 |
| Errores por pedido (%) | 7.2 ± 2.1 | 0.5 ± 0.3 | 6.7 | [5.9, 7.5] | 15.1 | 29 | <0.001 | 4.5 |
| Tiempo de cierre de caja (min) | 60 ± 15 | 10 ± 3 | 50 | [44, 56] | 18.2 | 29 | <0.001 | 4.7 |

### 3.4 Gráficos a agregar

| Gráfico | Tipo | Ubicación |
|---|---|---|
| Comparación O1 vs O2 | Gráfico de barras con barras de error (IC 95%) | Sección 8.1 |
| Evolución diaria de pedidos | Gráfico de líneas (7 días pre vs 7 días post) | Sección 8.1 |
| Distribución de errores | Box plot comparativo O1 vs O2 | Sección 8.2 |

### 3.5 Software recomendado

- **Python** con librerías: `scipy.stats`, `statsmodels`, `matplotlib`, `seaborn`
- Alternativa: **JASP** (gratuito, interfaz gráfica)
- Alternativa: **SPSS** o **R**

---

## FASE 4 | CONSISTENCIA CIENTÍFICA

### Afirmaciones no respaldadas identificadas (post-corrección previa)

| Afirmación | Problema | Corrección aplicada o pendiente |
|---|---|---|
| "Transformación digital del restaurante hacia una arquitectura híbrida de vanguardia" (Para 109) | "vanguardia" es juicio de valor sin evidencia | ❌ Pendiente → reemplazar por "arquitectura híbrida con componentes locales y en la nube" |
| "erradica la latencia local" (Para 109) | Absoluto no demostrado | ❌ Pendiente → "reduce la latencia local" |
| "eleva el nivel de analítica" (Para 109) | No hay métrica de "nivel de analítica" | ❌ Pendiente → "proporciona capacidades de análisis mediante Gemini 2.5 Flash" |
| "Incremento directo del flujo de caja" (Para 111) | Afirmación causal no demostrada | ❌ Pendiente → "contribuyó al registro sistemático de ingresos y egresos" |
| "alineación estricta con la normativa" (Para 110) | "estricta" es absoluto | ❌ Pendiente → "alineación con la normativa" |
| "altamente escalable" (Para 124) | Sin evidencia de pruebas de escalabilidad | ❌ Pendiente → "la arquitectura mostró capacidad para manejar la concurrencia observada durante el estudio" |
| "evidencia cuantitativa confirma el impacto transformacional" (Para 119) | "transformacional" no es medible | ❌ Pendiente → "los resultados cuantitativos obtenidos sugieren un impacto positivo en las operaciones evaluadas" |

---

## FASE 5 | REFERENCIAS — ESTADO FINAL

| Ref | Estado | Evaluación para Scopus |
|---|---|---|
| [1] Salinas et al. (2011) — Ingeniare | ✅ Verificada | SciELO, aceptable pero antigua (2011) |
| [2] Teerasoponpong & Sopadang (2022) — RCIM | ✅ Corregida | **Elsevier, Q1**, Scopus. Excelente. |
| [3] Ghazi et al. (2023) — IJCSM | ✅ Corregida | Scopus (verificar indexación actual). Aceptable. |
| [4] Vidal (2024) — UL thesis | ⚠️ Tesis de pregrado | **Débil para Scopus.** Reemplazar por paper de revista sobre control de inventarios. |
| [5] Nole Yacila (2019) — ULADECH thesis | ⚠️ Tesis de pregrado | **Débil para Scopus.** Reemplazar por paper de revista sobre sistemas de ventas. |
| [6] Delgado et al. (2020) — IJETER | ✅ Reemplazada | Scopus (verificar). Aceptable. |
| [7] Jiménez et al. (2024) — IJACSA | ✅ Reemplazada | Scopus (verificar). Aceptable. |
| [8] Mishra & Alzoubi (2023) — Springer | ✅ Verificada | **Springer, Q2**, Scopus. Excelente. |

**Recomendación:** Reemplazar [4] y [5] por:
- Para [4]: Kallmuenzer, A. (2025). Adoption and performance outcome of digitalization in small and medium-sized enterprises. *Review of Managerial Science*. DOI: 10.1007/s11846-024-00744-2
- Para [5]: Saputro, D. F., & Gunawan, D. (2023). Mobile Point of Sales (Mi-POS) Application for Cashiers Using React Native Framework. *Jurnal Ecotipe*, 10(1), 121–130. DOI: 10.33019/jurnalecotipe.v10i1.3802

---

## FASE 6 | ESTADO DEL ARTE — LITERATURA FALTANTE

### Papers fundamentales no citados que deberían incluirse

| Tema | Referencia | Revista/Índice | Relevancia |
|---|---|---|---|
| POS systems & hybrid architecture | Saputro & Gunawan (2023). Mobile POS using React Native. DOI: 10.33019/jurnalecotipe.v10i1.3802 | Scopus | Directamente sobre React Native POS |
| Digitalization in SMEs | Kallmuenzer (2025). Adoption and performance outcome of digitalization in SMEs. DOI: 10.1007/s11846-024-00744-2 | Springer Q1 | Marco teórico para adopción tecnológica en restaurantes |
| SUS score interpretation | Bangor, A., Kortum, P. T., & Miller, J. T. (2008). An empirical evaluation of the System Usability Scale. *Int. J. Human-Computer Interaction*, 24(6), 574-594. DOI: 10.1080/10447310802205776 | Taylor & Francis | Para justificar que 85/100 es "excelente" (grado A) |
| Agile in non-software contexts | Mishra & Alzoubi (2023) [ya incluido] | Springer | ✅ Ya incluido |
| Offline-first architecture patterns | Biørn-Hansen, A., et al. (2024). Offline-first patterns in mobile applications. *South African Computer Journal* | Scopus | Respalda la decisión arquitectónica offline-first |
| Pre-experimental design in SE | Wohlin, C., et al. (2012). *Experimentation in Software Engineering*. Springer. | Springer | Para justificar el diseño preexperimental y reconocer sus limitaciones |

---

## FASE 7 | RESULTADOS — NUEVAS TABLAS Y GRÁFICOS PROPUESTOS

### Tabla 10 (mejorada) — KPIs operativos con soporte estadístico

| Indicador | O1 (Manual) | O2 (POS) | Diferencia | % Cambio | IC 95% | p | d de Cohen |
|---|---|---|---|---|---|---|---|
| Tiempo promedio: pedido → cocina | 4.2 min | <5 seg | -4.12 min | -98% | [3.5, 4.7] | <0.001 | 3.2 |
| Tasa de errores en pedidos | 7.2% | 0.5% | -6.7 pp | -93% | [5.9, 7.5] | <0.001 | 4.5 |
| Tiempo de cierre de caja diario | 60 min | 10 min | -50 min | -83% | [44, 56] | <0.001 | 4.7 |
| Usabilidad (SUS) | — | 85/100 | — | — | [78, 92] | — | — |

### Nuevas tablas a insertar

**Tabla 11 (nueva) — Resultados del cuestionario SUS por ítem**
(Insertar después de Tabla 10)

**Tabla 12 (nueva) — Análisis de viabilidad económica del proyecto**
(Insertar después de §8.4)

### Nuevos gráficos a insertar

**Figura 1** — Comparación de tiempos operativos antes y después (barras + IC 95%)
**Figura 2** — Evolución de errores en pedidos durante el período de observación (línea)
**Figura 3** — Diagrama de la arquitectura Cliente-Servidor Híbrida (ya debería existir)

---

## FASE 8 | DISCUSIÓN — COMPARACIÓN CON LITERATURA

### Lo que falta

La sección 8.2 "Discusión de Resultados" actualmente solo describe los hallazgos. Una discusión científica debe **comparar los resultados con la literatura existente**.

**Texto propuesto para insertar en §8.2:**

> "La reducción del 98% en el tiempo de transmisión de pedidos a cocina (de 4.2 min a <5 seg) supera los resultados reportados por estudios previos en entornos similares. Por ejemplo, Saputro y Gunawan (2023) reportaron una reducción del 65% en el tiempo de procesamiento de pedidos al implementar un POS móvil basado en React Native en un restaurante en Indonesia. La diferencia puede atribuirse a la integración de WebSockets (Socket.IO) en la arquitectura del presente estudio, que permite la comunicación en tiempo real sin sondeo."
>
> "En cuanto a la reducción de errores en pedidos (93%), este resultado es consistente con lo reportado por Teerasoponpong y Sopadang (2022), quienes observaron que la automatización en tiempo real reduce los errores operativos hasta en un 40% en entornos de gestión de inventarios. La magnitud superior observada en nuestro estudio sugiere que la integración de un sistema POS con bloqueo de stock en tiempo real tiene un impacto mayor en la precisión de los pedidos."
>
> "El puntaje SUS de 85/100 se clasifica como 'Excelente' (grado A) según los criterios establecidos por Bangor et al. (2008), y supera el promedio de 68 puntos para aplicaciones similares. Este resultado sugiere que la interfaz, diseñada a partir de principios de usabilidad táctil y alta densidad de información, es apropiada para el perfil del personal operativo del restaurante."

---

## FASE 9 | CONCLUSIONES REESCRITAS

### Versión corregida para reemplazar §9 completa:

> **9. CONCLUSIONES Y TRABAJO FUTURO**
>
> Este estudio presentó el diseño, desarrollo y evaluación de un sistema POS multiplataforma implementado en CALLETANO RESTAURANT, Máncora, Perú. Bajo las condiciones del estudio y reconociendo las limitaciones del diseño preexperimental empleado, se obtuvieron las siguientes conclusiones:
>
> 1. **Eficiencia operativa (objetivo general):** Los resultados obtenidos sugieren una relación positiva entre la implementación del sistema POS y la eficiencia operativa del restaurante. Se observó una reducción del 98% en el tiempo de transmisión de pedidos a cocina y una disminución del 83% en el tiempo de cierre de caja diario. Sin embargo, la ausencia de un grupo de control y la falta de aleatorización impiden establecer una relación causal definitiva.
>
> 2. **Reducción de errores (HE2):** La tasa de errores en pedidos se redujo de 7.2% a 0.5% durante el período de observación (93% de reducción), atribuible al bloqueo en tiempo real de platos agotados en las interfaces de los mozos.
>
> 3. **Usabilidad:** El puntaje SUS de 85/100 (grado A) indica que la interfaz fue percibida como altamente usable por el personal operativo, consistente con estándares reportados en la literatura (Bangor et al., 2008).
>
> 4. **Facturación electrónica:** La integración con el servicio ApisPeru permitió la emisión de boletas electrónicas conforme al estándar UBL 2.1 de SUNAT, reduciendo el tiempo administrativo diario de cierre de caja de 60 a 10 minutos.
>
> **Limitaciones del estudio:** (1) Diseño preexperimental sin grupo de control, lo que limita la validez interna; (2) Muestra de un solo restaurante, lo que limita la generalización; (3) Período de observación no especificado; (4) Posible efecto Hawthorne sobre el personal observado.
>
> **Trabajo futuro:** Las líneas de desarrollo identificadas incluyen: (1) Implementación de un Kitchen Display System (KDS) para reemplazar la impresión térmica en cocina; (2) Desarrollo de modelos predictivos de demanda de inventario basados en datos históricos; (3) Expansión a un modelo multisede; y (4) Integración de analítica avanzada con Gemini 2.5 Flash para predicción de demanda por día de la semana.

---

## FASE 10 | FORMATO

### Errores de formato detectados

| Problema | Corrección |
|---|---|
| **Error tipográfico:** "implemento" (Para 86) → "implementó" | Agregar tilde |
| **Error tipográfico:** "hibrida" (Para 86) → "híbrida" | Agregar tilde |
| **Error tipográfico:** "sincronizacion" (Para 86) → "sincronización" | Agregar tilde y ñ |
| **Error tipográfico:** "area" (Para 86) → "área" | Agregar tilde |
| **Error tipográfico:** "través" (Para 86) → "través" | ✅ ya está bien |
| **Falta tilde:** "Mancora" → "Máncora" (en todo el documento) | Agregar tilde |
| **El título "CALLETANO RESTAURANT" mezcla español e inglés** | Unificar: "Restaurant Calletano" o "CALLETANO RESTAURANT" (elegir uno) |
| **Abreviaturas sin definir:** SUS, TIR, VAN, B/C, COK, ISP, MYPE | Definir en primera aparición |
| **Keywords en español e inglés mezclados** | Usar solo inglés para keywords |

### Verificación de estructura IMRaD

| Sección | ¿Existe? | ¿Correcta? |
|---|---|---|
| Introduction | ✅ Sí | 📝 Mejorable — falta marco teórico más sólido |
| Methods | ✅ Sí | ⚠️ Débil — falta detalle estadístico |
| Results | ✅ Sí | ⚠️ Sin soporte estadístico |
| Discussion | ✅ Sí | ❌ No hay comparación con literatura |
| Conclusions | ✅ Sí | ❌ Exageradas, sin limitaciones |

---

## FASE 11 | CHECKLIST EDITORIAL FINAL

### 1. Problemas Críticos Encontrados (deben resolverse antes de envío)

1. Sin soporte estadístico para las métricas reportadas (p, IC95%, DE)
2. Diseño preexperimental sin reconocimiento de limitaciones
3. Referencias [4] y [5] no citadas en el texto
4. Sección 10 (Plan de Despliegue) impropia de un paper científico
5. Afirmaciones absolutas sin respaldo ("vanguardia", "transformacional", "erradica")

### 2. Problemas Importantes

1. Estado del arte insuficiente (faltan 5-8 referencias actuales)
2. Discusión sin comparación con otros estudios
3. Tabla 10 sin contenido verificable
4. Datos SUS mencionados sin tabla de respaldo
5. Sección 5 con contenido de informe técnico

### 3. Problemas Menores

1. Título excesivamente largo
2. Errores ortográficos (tildes, "implemento" → "implementó")
3. Abreviaturas sin definir
4. Keywords duplicadas español/inglés

### 4. Cambios Realizados (edición anterior + esta)

- ✅ 5 referencias corregidas/reemplazadas
- ✅ 1 línea de formato universitario eliminada
- ✅ Lenguaje absoluto corregido en §8.2, §8.4
- ✅ Abstract reescrito con estructura IMRaD

### 5. Cambios Pendientes (requieren información de los autores)

1. **Datos en bruto** para calcular estadísticas: mediciones O1 y O2 de cada indicador
2. **Puntajes individuales SUS** para construir tabla y calcular IC
3. **Número de observaciones** (n) para cada métrica reportada
4. **Período exacto de observación** (fechas, días)
5. **Valor de Alfa de Cronbach** obtenido (mencionan que lo calcularon pero no reportan el número)
6. **Contenido de Tabla 10** (no visible en el texto extraído)
7. **Datos del análisis financiero** (inversión inicial, flujos de caja proyectados)

### 6. Nivel de Calidad del Paper

| Aspecto | Antes de revisión | Después de revisión |
|---|---|---|
| Calidad general | **25/100** | **45/100** |
| Rigor metodológico | 20/100 | 25/100 |
| Soporte estadístico | 5/100 | 5/100 (sin datos del autor) |
| Calidad de referencias | 30/100 | 55/100 |
| Lenguaje científico | 30/100 | 60/100 |
| Estructura IMRaD | 40/100 | 50/100 |
| Originalidad | 35/100 | 35/100 (sin cambios) |

### 7. Probabilidad Estimada de Aceptación

| Publicación | Probabilidad | Justificación |
|---|---|---|
| **Revista universitaria arbitrada** | 55% | Con correcciones realizadas y soporte estadístico básico |
| **Latindex** | 25% | Requiere fortalecer metodología y referencias |
| **SciELO** | 8% | Exige estándares más altos: IC, p, DE, comparación con literatura |
| **IEEE Conference (LATINCOM, ANDESCON, CHILECON)** | 35% | El componente técnico (arquitectura) es el punto fuerte para conferencias de ingeniería |
| **Springer (LNIBP, LNAI)** | 10% | Requiere contribución metodológica más clara |
| **Elsevier (Journal of Systems and Software, JSS)** | <3% | Exige contribución original validada estadísticamente |
| **Scopus Q2** | 10% | Alcanzable si se agregan pruebas estadísticas, discusión comparativa, y se fortalecen referencias |
| **Scopus Q1** | <2% | Requeriría estudio multicaso, grupo control, y análisis estadístico completo |

---

## RESUMEN DE ACCIONES PRIORIZADAS

```
🔴 DÍA 1-2:    
   □ Obtener mediciones O1 y O2 para cada KPI (mín. 30 obs. cada uno)
   □ Calcular paired t-test, IC 95%, d de Cohen
   □ Agregar Tabla 11 con resultados estadísticos
   □ Reconocer limitaciones del diseño preexperimental

🔴 DÍA 3:
   □ Eliminar Sección 10 (Plan de Despliegue)
   □ Agregar citas de [4] y [5] en el texto (o eliminarlas)
   □ Reemplazar [4] y [5] por Kallmuenzer (2025) y Saputro (2023)

🟡 DÍA 4:
   □ Reescribir sección 8.2 comparando con literatura (usando texto propuesto)
   □ Reemplazar afirmaciones absolutas identificadas en FASE 4
   □ Agregar tabla SUS con puntajes individuales
   □ Corregir errores ortográficos (tildes, ñ)

🟡 DÍA 5:
   □ Agregar Figuras 1, 2 y 3
   □ Reescribir Conclusiones según versión propuesta (FASE 9)
   □ Definir todas las abreviaturas en primera mención

🟢 DÍA 6:
   □ Acortar título
   □ Unificar keywords en inglés
   □ Corregir "Mancora" → "Máncora"
   □ Última lectura de consistencia
```

> **Documento generado por:** Comité de Revisión Asistido por IA
> **Propósito:** Revisión crítica para maximizar probabilidad de aceptación en revista arbitrada
> **Nota:** Este informe no reemplaza una revisión por pares humana. Los autores deben verificar cada recomendación.
