---
tags: [producto, ux]
---
# User Journey del FDE

1. Importa el log del cliente o define el proceso en Studio; ve el mapa generarse.
2. Corre la línea base a 200× y observa dónde se acumulan las cajas.
3. Identifica el cuello de botella (p. ej. Revisión) y lo confirma con métricas.
4. Crea una variante (un revisor más / regla que deriva casos pequeños a automático) y la corre con la **misma semilla**.
5. Compara ambas corridas y exporta informe con gráficas y replay para el cliente.
6. Guarda la definición versionada.

## Momentos de verdad
- **Primeros 5 segundos**: desde el zoom out debe entenderse dónde está el problema.
- **Navegación**: ofrecer teletransporte desde alertas y modo "tablero" tradicional.
- **Confianza**: mostrar semilla, versión del proceso y origen de los datos en cada corrida.

## Prueba de validación
Prototipo de una pantalla (4 salas, ~30 cajas): ¿identifica el supervisor el cuello de botella en < 10 s?
