# Reconstrucción frontend HTDE

## Diagnóstico

El frontend anterior mezclaba biblioteca, sincronización, editor desktop, editor
móvil y diagrama React Flow en un único `App.tsx`. La misma guía tenía dos
editores distintos y el grafo obligaba a entender nodos, handles y conexiones
para escribir una secuencia de instrucciones.

El contrato real del servidor es un documento `Runbook` completo dentro de
`{ runbook, expectedVersion? }`. El servidor no guarda pasos individualmente:
`nodes`, `startNode`, conexiones y multimedia viajan juntos. Por eso no era
necesario ni correcto cambiar API, base de datos o backend.

## Causa de la pérdida aparente de pasos

El ciclo investigado fue editor → estado React → `App.update` →
`ServerRunbookRepository.save` → PUT/POST → respuesta → `/api/sync` → migración.
El repositorio ya serializaba el array completo. El fallo estaba antes: `update`
reemplazaba el elemento de la biblioteca comparando contra `book?.id` capturado
por el render, en vez del `id` del documento entrante. Además iniciaba el guardado
sin esperarlo y `persistRunbook` consumía el error. Así, el editor podía borrar su
borrador y mostrar una salida satisfactoria aunque la biblioteca conservase el
snapshot inicial (frecuentemente sólo `Start`) o el servidor rechazase el PUT.

Ahora el documento entrante se identifica por `next.id`, el editor espera la
confirmación, conserva el borrador hasta recibirla y expone estado de guardado y
errores. Los tests cubren una reconstrucción JSON de veinte pasos y preservación
de ramas y multimedia antiguas.

## Arquitectura aplicada

* Se conserva el modelo y contrato JSON, el repositorio offline/server, la
  autenticación, importación, biblioteca, runner y endpoints de multimedia.
* El paradigma principal pasa a ser un documento: índice compacto de pasos,
  editor central y contexto de persistencia. En móvil se ocultan paneles laterales
  y se usa un paginador fijo, evitando una columna interminable.
* Una capa adaptadora recorre datos de grafo antiguos de forma determinista. Las
  ramas se conservan y aparecen tras su paso padre; los nodos no alcanzables se
  mantienen al final para evitar pérdida de contenido.
* Añadir, eliminar y reordenar actualiza tanto el array como las referencias
  `nextNode`, por lo que el backend existente y el runner siguen funcionando.
* El viejo editor de diagrama queda sin montar. Su código se mantiene
  temporalmente sólo como referencia de compatibilidad; puede retirarse en una
  limpieza posterior cuando no se necesite comparar comportamiento histórico.
