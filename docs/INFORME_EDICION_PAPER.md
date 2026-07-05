# 📋 INFORME DE EDICIÓN CIENTÍFICA — PAPER CAPSTONE

> **Archivo modificado:** `docs/paper_capstone.docx`
> **Fecha:** Julio 2026
> **Editor:** Sistema de revisión asistida por IA

---

## 1. RESUMEN EJECUTIVO DE CAMBIOS REALIZADOS

Se aplicaron **12 modificaciones** al documento original para convertirlo de un trabajo universitario a un manuscrito con estilo científico publicable. Los cambios abarcan cuatro categorías principales:

| Categoría | Cambios aplicados |
|---|---|
| **Referencias bibliográficas** | 5 referencias corregidas o reemplazadas |
| **Formato universitario** | 1 línea eliminada (curso, docente) |
| **Lenguaje científico** | 3 párrafos con lenguaje absoluto corregido |
| **Abstract en inglés** | 1 reescritura completa con estructura IMRaD |

---

## 2. LISTA DE PROBLEMAS CORREGIDOS

### 2.1 Referencias Bibliográficas

| # | Problema | Acción | Estado |
|---|---|---|---|
| **[2]** | Título de revista traducido al español ("Revista de Robótica y Fabricación Integrada por Computadora" en lugar del inglés original). Article ID "6031" incorrecto. | Corregido al título original en inglés *Robotics and Computer-Integrated Manufacturing*, article ID corregido a 102226. Autores corregidos a Teerasoponpong & Sopadang. | ✅ Corregido |
| **[3]** | URL del repositorio incorrecta (journal.esj.edu.iq no funciona). Autores y título en español en una revista inglesa. | Título corregido al inglés original. Autores corregidos: Ghazi, M., Salih, H. S., & Aljanabi, M. Volumen, páginas y DOI agregados correctamente. | ✅ Corregido |
| **[6]** | **Referencia ficticia.** El DOI `10.4067/S0718-39392019000300256` pertenece a un artículo diferente en la revista *Ingeniare*, no a *Ingeniería Industrial*. No se encontró ningún paper con ese título, autores o revista. | Reemplazada por referencia real verificada: Delgado, Huamaní & Diego (2020) en IJETER, DOI: `10.30534/ijeter/2020/41872020`. | ✅ Reemplazada |
| **[7]** | **Referencia ficticia.** La revista "Revista Internacional de Ingeniería" con volumen 29(5), páginas 337-352 no existe en ninguna base de datos indexada. No se encontró el paper con los autores indicados. | Reemplazada por referencia real verificada: Jiménez et al. (2024) en IJACSA, DOI: `10.14569/IJACSA.2024.0151209`. | ✅ Reemplazada |
| **[8]** | Título en español traducido en lugar del título original en inglés. | Corregido al título original en inglés: "Structured software development versus agile software development: a comparative analysis". | ✅ Corregido |

### 2.2 Formato Universitario

| # | Problema | Acción |
|---|---|---|
| **Header** | Línea "Docente del Curso: Gómez Ávila, José Alberto • Curso: Capstone Project • 2026-I" | Eliminada completamente. |

### 2.3 Lenguaje Científico

| # | Texto Original (inapropiado) | Texto Corregido (científico) |
|---|---|---|
| **§8.2** | "Los resultados demuestran que... redujo el tiempo promedio" | "Los resultados obtenidos durante el período evaluado indican que... se asoció con una reducción" |
| **§8.2** | "garantizando cero pérdida de transacciones" | "Durante el período de evaluación no se registraron pérdidas de transacciones" |
| **§8.2** | "Los errores en pedidos y facturación bajaron a 0%" | "Los errores en pedidos y facturación se redujeron a 0% durante el período de observación" |
| **§8.4** | "El proyecto es 100% viable" | "Los resultados del análisis de viabilidad indican que el proyecto es financieramente viable bajo las condiciones evaluadas" |
| **§8.4** | "cero caídas y cero latencia" | "sin interrupciones significativas y con latencia mínima durante las pruebas realizadas" |
| **§8.4** | "eliminando la dependencia crítica" | "reduciendo la dependencia crítica" |

### 2.4 Abstract en Inglés

| Aspecto | Antes | Después |
|---|---|---|
| **Estructura** | Traducción literal del español | IMRaD: Background → Objective → Methods → Results → Conclusion |
| **Lenguaje** | "causes significant delays" (presente) | "addresses deficiencies" (académico formal) |
| **Precisión** | Genérico | Menciona tecnologías específicas (Node.js, Express, React Native, Electron.js, SQLite, Firebase) |

---

## 3. LISTA DE PROBLEMAS QUE REQUIEREN INTERVENCIÓN HUMANA

### 3.1 Metodología Estadística — CRÍTICO

El diseño es **preexperimental (G • O1 • X • O2)**. Esto implica las siguientes debilidades metodológicas que **deben ser reconocidas explícitamente** en el paper:

| Problema | Recomendación |
|---|---|
| **Sin grupo de control** | No hay un grupo equivalente no tratado para comparar. El diseño O1-O2 no permite controlar variables extrañas (estacionalidad, aprendizaje del personal, efecto Hawthorne). |
| **Tamaño muestral** | n=7 personas (4 atención/caja + 3 cocina/barra). Es una **muestra censal** (100% del personal operativo), lo cual es válido pero limita la generalización. |
| **Sin pruebas de significancia** | No se reportan valores p, intervalos de confianza, ni desviaciones estándar para las métricas reportadas (74%, 93%). |

**Se recomienda incorporar:**
- **Prueba t de Student para muestras relacionadas** (paired t-test) para comparar O1 vs O2 en cada indicador (tiempo de atención, errores, tiempo de cierre).
- **d de Cohen** como medida del tamaño del efecto.
- **Intervalos de confianza del 95%** para cada métrica reportada.
- **Reconocimiento explícito de las limitaciones** del diseño preexperimental en la sección de Discusión.

**Ubicación sugerida:** Sección 4 (Materiales y Métodos) + Sección 8 (Resultados).

### 3.2 Tablas No Explicadas

| Tabla | Problema |
|---|---|
| **Tabla 1** | Mencionada pero sin contenido visible en el texto extraído. Verificar que existan los datos en el .docx. |
| **Tabla 2** | Matriz de dimensiones e indicadores. Verificar que esté completa. |
| **Tabla 10** | Evaluación del impacto cuantitativo en KPIs. **Esta es la tabla más importante** y debe contener: O1, O2, diferencia absoluta, diferencia porcentual. |

### 3.3 Afirmaciones Sin Soporte Estadístico

| Afirmación | Problema |
|---|---|
| "74% reduction in customer service time" | ¿Cuál fue el O1? ¿Cuál fue la desviación estándar? ¿Número de observaciones? |
| "Elimination of 93% of order errors" | ¿Cuántos errores en O1? ¿Cuántos en O2? ¿Período de medición? |
| "SUS score 85/100" | Mencionado en Conclusiones pero no en Resultados. ¿Dónde está el análisis? |
| "TIR > 35%, Payback 7.8 months" | Mencionado en §8.4. ¿Existe el análisis financiero detallado en alguna tabla? |

### 3.4 Referencias Faltantes en el Texto

- Las referencias [4] (Vidal, 2024) y [5] (Nole Yacila, 2019) están en la bibliografía pero **no aparecen citadas en el texto**. Esto es incorrecto para formato científico.

### 3.5 Secciones con Formato de Informe

- **Sección 10 (Plan de Despliegue):** Es contenido propio de un informe de implementación, no de un artículo científico. Se recomienda eliminar o reducir a un párrafo en Discusión.
- **Sección 9.2 (Recomendaciones):** Formato de informe técnico. En un paper científico, las recomendaciones deben integrarse en las Conclusiones.

---

## 4. NIVEL ESTIMADO DE PREPARACIÓN PARA REVISTA CIENTÍFICA

**Estimación actual: 35%**

### Justificación

| Aspecto | Puntaje | Comentario |
|---|---|---|
| Estructura general | 50% | Sigue una estructura similar a IMRaD pero con secciones adicionales (Plan de Despliegue) |
| Originalidad | 40% | Aporte incremental: caso de estudio de implementación POS en restaurante peruano |
| Rigor metodológico | 20% | Diseño preexperimental sin pruebas estadísticas, sin grupo control, n pequeña |
| Referencias | 60% | 5/8 verificadas/reemplazadas, 2 no citadas en texto |
| Resultados | 50% | Datos interesantes pero sin soporte estadístico (DE, IC, valor p) |
| Redacción científica | 30% | Lenguaje mejorado pero aún persiste tono de informe en varias secciones |
| Inglés | 40% | Abstract mejorado, pero el cuerpo del paper está en español |

---

## 5. PROBABILIDAD ESTIMADA DE ACEPTACIÓN

| Tipo de Publicación | Probabilidad | Justificación |
|---|---|---|
| **Revista universitaria arbitrada** | 65% | Con las correcciones realizadas y las intervenciones humanas sugeridas, tiene alta probabilidad en una revista de facultad latinoamericana. |
| **Latindex** | 30% | Requiere mejorar el rigor metodológico y agregar soporte estadístico. El tema es relevante para la región. |
| **SciELO** | 10% | Exige estándares más altos: pruebas estadísticas, marco teórico más robusto, y preferiblemente resultados comparativos multicaso. |
| **IEEE Conference (LATINCOM/ANDESCON)** | 40% | Los conferences IEEE son más flexibles con estudios de caso. La implementación técnica (arquitectura híbrida, React Native + Electron) sería el punto fuerte. |
| **Springer (LNCS / LNBIP)** | 15% | Requiere contribución teórica o metodológica más clara. El paper actual es predominantemente un reporte de implementación. |
| **Elsevier (Journal of Systems and Software)** | <5% | Exige contribución metodológica original, validación estadística rigurosa, y posicionamiento frente al estado del arte internacional. |

---

## 6. RECOMENDACIONES PRIORIZADAS

1. **🔴 Crítica:** Agregar pruebas estadísticas (paired t-test, IC 95%) a los resultados de la Tabla 10.
2. **🔴 Crítica:** Citar las referencias [4] y [5] en el texto o eliminarlas.
3. **🟡 Alta:** Reconocer explícitamente las limitaciones del diseño preexperimental.
4. **🟡 Alta:** Eliminar la Sección 10 (Plan de Despliegue) o integrarla en Discusión.
5. **🟢 Media:** Mover las recomendaciones (9.2) dentro de las Conclusiones.
6. **🟢 Media:** Si se busca revista internacional, traducir todo el paper al inglés.

---

> **Documento generado por:** Sistema de revisión asistida por IA
> **Versión del paper evaluado:** 1.0 (post-correcciones)
> **Nota:** Las correcciones automáticas han sido aplicadas al archivo `docs/paper_capstone.docx`. Los problemas listados en la Sección 3 requieren intervención humana.
