// ══════════════════════════════════════════════════════════════
// TUTORIAL — "Aprende a usar Portal SAES"
// Modal explicativo a pantalla completa con guía detallada de
// cada sección del portal. No depende de Firebase: es 100% local.
// ══════════════════════════════════════════════════════════════
(function () {

  // ── Definición de secciones ────────────────────────────────────
  // Cada sección: { id, icon, label, html }
  const SECTIONS = [
    {
      id: 'bienvenida',
      icon: 'ti-home-2',
      label: 'Bienvenida',
      html: `
        <h2><i class="ti ti-home-2"></i>Bienvenido al Portal SAES</h2>
        <p class="tut-intro">Esta es la guía completa del portal. Aquí encontrarás explicado, paso a paso,
        para qué sirve cada sección del menú, cómo se usa y qué hace cada botón. Usa el menú de la izquierda
        para saltar directamente al tema que necesites.</p>

        <div class="tut-block">
          <h3><i class="ti ti-info-circle"></i>¿Qué es el Portal SAES?</h3>
          <p>Es la herramienta interna del Contact Center del Instituto SISE para el equipo de
          <strong>Canal WhatsApp — Atención al Alumno</strong>. Centraliza todo lo que un asesor necesita
          para trabajar: plantillas de respuesta, tipificaciones, protocolo de atención, registro de
          llamadas, casos pendientes, capacitaciones, herramientas de trabajo y seguimiento de su
          satisfacción/ranking.</p>
          <p>Todo se guarda en tiempo real: si tú o un compañero hacen un cambio (por ejemplo, agregar una
          plantilla nueva o resolver un caso pendiente), se actualiza para todos automáticamente, sin
          necesidad de recargar la página.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-users"></i>Roles dentro del portal</h3>
          <p>Tu rol determina qué botones de edición ves. Estos son los roles que existen:</p>
          <p>
            <span class="tut-role asesor">Asesor</span>
            <span class="tut-role bo">BO</span>
            <span class="tut-role supervisor">Supervisor</span>
            <span class="tut-role formador">Formador</span>
          </p>
          <ul>
            <li><strong>Asesor</strong>: acceso normal a todas las vistas, sin botones de "gestionar",
            "editar" o "eliminar".</li>
            <li><strong>BO, Supervisor y Formador</strong>: además de todo lo anterior, ven una barra
            naranja de "Modo gestor activo" en Tipificaciones, Plantillas, Protocolo, Academia SAES,
            Herramientas y Logros, desde donde pueden crear, editar o borrar contenido.</li>
          </ul>
          <div class="tut-tip"><i class="ti ti-bulb"></i>Si no ves un botón de edición que esperabas ver,
          es probable que tu rol actual no tenga ese permiso. Si crees que debería ser distinto, contacta
          al formador o supervisor.</div>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-layout-sidebar"></i>El menú lateral</h3>
          <p>El menú de la izquierda está organizado por bloques:</p>
          <ul>
            <li><strong>Menú</strong>: Inicio y Satisfacción (tu resumen y tu ranking).</li>
            <li><strong>Recursos</strong>: Plantillas, Tipificaciones, Preguntas frecuentes y Herramientas
            de trabajo — lo que más usarás día a día.</li>
            <li><strong>Gestión</strong>: Registro de llamadas y Casos pendientes — donde se documenta el
            trabajo de Back Office.</li>
            <li><strong>Formación</strong>: Academia SAES (capacitaciones) y este tutorial.</li>
            <li><strong>Cuenta</strong>: Configuración del portal y la sección "Acerca de".</li>
          </ul>
          <div class="tut-tip"><i class="ti ti-bulb"></i>Los números rojos/naranjas junto a "Registro de
          llamadas" y "Casos pendientes" indican cuántos casos siguen activos/pendientes. Si ves un número
          alto, esa es tu prioridad del día.</div>
        </div>
      `
    },

    {
      id: 'inicio',
      icon: 'ti-layout-dashboard',
      label: 'Inicio',
      html: `
        <h2><i class="ti ti-layout-dashboard"></i>Inicio</h2>
        <p class="tut-intro">Es la pantalla de bienvenida y tu panel de control rápido. Aquí ves un resumen
        de todo lo importante sin tener que entrar a cada sección.</p>

        <div class="tut-block">
          <h3><i class="ti ti-clock"></i>Reloj y saludo</h3>
          <p>Arriba a la derecha verás la hora actual de Lima (Perú) en tiempo real. A la izquierda, un
          saludo con tu nombre y tu rol actual.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-list-numbers"></i>Tarjetas de acceso rápido</h3>
          <p>Las tarjetas grandes (Registro de llamadas, Casos pendientes, Plantillas, Preguntas frecuentes,
          Academia SAES) son atajos: si haces clic en cualquiera, te lleva directo a esa sección. Es lo
          mismo que hacer clic en el menú lateral, solo que más visual.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-chart-bar"></i>Barra de estadísticas</h3>
          <p>Justo debajo del encabezado verás tres datos que se actualizan en tiempo real:</p>
          <ul>
            <li><strong>BO Llamadas pendientes</strong>: cuántos registros de llamadas siguen marcados como
            "pendiente" o "no contesta" (sin atender) en cualquier mes. Haz clic para ir directo al
            registro.</li>
            <li><strong>Casos pendientes</strong>: cuántos casos de "Casos pendientes" siguen sin marcar
            como "resuelto". Haz clic para ir a esa vista.</li>
            <li><strong>Tu posición / tiempo de sesión</strong>: tu puesto actual en el ranking de
            satisfacción (si ya tienes registros este mes) y cuánto tiempo llevas conectado en esta
            sesión.</li>
          </ul>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-users-group"></i>Banner de roles</h3>
          <p>Más abajo hay un recuadro que explica brevemente qué puede hacer cada rol (Asesor, BO,
          Supervisor, Formador) dentro del portal — es un resumen visual de lo mismo que se explicó en la
          sección "Bienvenida" de este tutorial.</p>
        </div>

        <div class="tut-tip"><i class="ti ti-bulb"></i>Si Inicio tarda en mostrar los números (BO, Casos
        pendientes, tu posición), espera unos segundos: estos datos se cargan en tiempo real desde la base
        de datos y pueden tardar un instante la primera vez que abres el portal.</div>
      `
    },

    {
      id: 'satisfaccion',
      icon: 'ti-trophy',
      label: 'Satisfacción / Ranking / Logros',
      html: `
        <h2><i class="ti ti-trophy"></i>Satisfacción, Ranking y Logros</h2>
        <p class="tut-intro">Esta vista (morada, con fondo oscuro) muestra cómo va tu desempeño de
        satisfacción comparado con el resto del equipo, además de los logros que vas desbloqueando.</p>

        <div class="tut-block">
          <h3><i class="ti ti-podium"></i>Podio y ranking completo</h3>
          <p>Arriba se muestra un podio con el top 3 de asesores del mes (según % de satisfacción). Debajo
          aparece el "Ranking completo" con la lista de todos los asesores ordenados de mayor a menor
          porcentaje.</p>
          <ul>
            <li>Cada fila muestra el nombre del asesor, su porcentaje y su "nivel" (Bronce, Plata, Oro,
            Esmeralda o Diamante, según el porcentaje).</li>
            <li>Si tú apareces en la lista, tu fila se resalta para que te ubiques fácilmente.</li>
          </ul>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-filter"></i>Filtrar y buscar</h3>
          <p>Puedes buscar a un asesor por nombre con la barra de búsqueda, o usar los filtros/pestañas
          ("Por semana" / "Por día") para ver el historial detallado de cómo evolucionó el porcentaje de
          cada persona a lo largo del mes.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-bell-ringing"></i>Notificaciones de ranking (esquina inferior derecha)</h3>
          <p>Cada vez que se actualiza el ranking (porque el supervisor sube un nuevo reporte de Genesys),
          el portal te avisa con una notificación tipo "logro de videojuego" en la esquina inferior
          derecha. Estas son las que pueden aparecer:</p>
          <ul>
            <li><strong>👑 ¡Estás en el #1! / ¡Estás en el top 2-3!</strong> — tu posición la primera vez
            que entras al portal en el mes.</li>
            <li><strong>👑 Nuevo líder del ranking</strong> — otra persona llegó al puesto #1 (no es sobre
            ti, es información general del equipo).</li>
            <li><strong>🥇/🥈/🥉/⬆️ Subiste en el ranking</strong> — tu porcentaje mejoró y subiste de
            puesto respecto a la actualización anterior.</li>
            <li><strong>⚡/📉 Bajaste en el ranking</strong> — bajaste de puesto. No es un castigo, es solo
            información para que sepas que puedes recuperar posiciones.</li>
            <li><strong>📌 Te mantienes en el puesto #X</strong> — el ranking cambió (otras personas
            subieron o bajaron) pero tu posición exacta sigue igual.</li>
            <li><strong>🏆 ¡Logro desbloqueado!</strong> — desbloqueaste un nuevo logro (ver siguiente
            apartado).</li>
          </ul>
          <div class="tut-tip"><i class="ti ti-hand-click"></i><strong>Tip importante:</strong> casi todas
          estas notificaciones son clicables. Si haces clic sobre una notificación de ranking, te lleva
          directo a esta vista de Satisfacción. Si haces clic en una notificación de "Logro desbloqueado",
          se abre directamente el modal de tus Logros.</div>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-medal"></i>Logros (🏆)</h3>
          <p>Dentro de Satisfacción hay una lista de asesores donde puedes hacer clic en tu nombre (o el de
          un compañero) para abrir el modal "🏆 Logros". Ahí verás:</p>
          <ul>
            <li>Un resumen con estadísticas (cuántos logros tienes, de cuántos posibles).</li>
            <li>Categorías de logros (filtros por tipo) para navegar más fácil.</li>
            <li>Tarjetas de cada logro: las que ya desbloqueaste se ven con color y brillo; las que aún no,
            aparecen en gris/oscurecidas con un candado.</li>
            <li>Cada tarjeta tiene su rareza: <strong>Común</strong>, <strong>Raro</strong>,
            <strong>Épico</strong> o <strong>Legendario</strong>.</li>
          </ul>
          <p>Los logros se calculan automáticamente según tu desempeño semanal: por ejemplo, llegar al #1,
          mantenerte sobre cierto porcentaje varias semanas seguidas, subir muchos puestos de golpe, tener
          tu mejor racha histórica, etc. No tienes que hacer nada manualmente — el sistema los detecta solo
          cuando el supervisor actualiza el reporte.</p>
        </div>

        <div class="tut-block tut-role-block">
          <h3><i class="ti ti-shield-check"></i>Para Supervisor / BO / Formador</h3>
          <p>Si tienes permisos de gestión, dentro de Satisfacción y del modal de Logros verás opciones
          adicionales para:</p>
          <ul>
            <li>Subir el reporte Excel de Genesys que actualiza el ranking del mes.</li>
            <li>Editar metas, ver el historial completo de un asesor o quitarlo del ranking si fue dado de
            baja.</li>
            <li>Crear, editar o eliminar definiciones de logros (nombre, ícono, rareza y condiciones para
            desbloquearlo).</li>
            <li>Asignar o quitar logros manualmente a un asesor si fuera necesario.</li>
            <li>Reiniciar el mes (cuando termina el periodo) — esto archiva el ranking actual y comienza
            uno nuevo. Los logros NO se borran al reiniciar el mes, salvo que se marque explícitamente la
            opción de borrarlos.</li>
          </ul>
          <div class="tut-warn"><i class="ti ti-alert-triangle"></i>Reiniciar el mes y borrar logros son
          acciones que afectan a todo el equipo. Si no estás seguro, consulta primero con el supervisor
          antes de usar estas opciones.</div>
        </div>
      `
    },

    {
      id: 'plantillas',
      icon: 'ti-file-text',
      label: 'Plantillas',
      html: `
        <h2><i class="ti ti-file-text"></i>Plantillas</h2>
        <p class="tut-intro">Son los mensajes prediseñados que usas para responder a los alumnos por
        WhatsApp de forma rápida, profesional y consistente.</p>

        <div class="tut-block">
          <h3><i class="ti ti-search"></i>Buscar una plantilla</h3>
          <p>Usa la barra de búsqueda de arriba. La búsqueda es <strong>inteligente</strong>: no necesitas
          escribir exactamente igual que el título — el sistema detecta sinónimos, errores de tipeo y
          palabras parecidas, y resalta en amarillo las coincidencias dentro del resultado.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-copy"></i>Copiar una plantilla</h3>
          <p>Cada fila de la lista tiene un botón <strong>"Copiar"</strong>. Al hacer clic, el texto de la
          plantilla se copia a tu portapapeles, listo para pegarlo en WhatsApp con <kbd>Ctrl+V</kbd>.</p>
          <p>También puedes hacer clic en el ícono de "ojo" (👁) para ver la plantilla completa antes de
          copiarla, incluyendo imágenes adjuntas si las tiene.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-replace"></i>Personalización automática</h3>
          <p>Algunas plantillas tienen partes variables que se reemplazan automáticamente antes de copiar,
          usando los campos de personalización que aparecen arriba de la lista:</p>
          <ul>
            <li><strong>[NOMBRE_USUARIO]</strong> → se reemplaza por el nombre del alumno que escribas en el
            campo correspondiente.</li>
            <li><strong>[NOMBRE_ASESOR]</strong> → se reemplaza por tu nombre como asesor.</li>
            <li><strong>[N°_CASO]</strong> → se reemplaza por el número de caso que indiques.</li>
            <li><strong>"__ días hábiles"</strong> → se reemplaza por la cantidad de días que escribas.</li>
          </ul>
          <p>Llena estos campos una sola vez (por ejemplo, al iniciar tu turno o al empezar un caso nuevo) y
          cada vez que copies una plantilla que use esas variables, el texto ya saldrá personalizado.</p>
          <div class="tut-tip"><i class="ti ti-bulb"></i>Si no llenas estos campos, las plantillas se
          copian igual, pero con el texto entre corchetes tal cual (ej: <em>[NOMBRE_USUARIO]</em>) — recuerda
          reemplazarlo manualmente en ese caso.</div>
        </div>

        <div class="tut-block tut-role-block">
          <h3><i class="ti ti-shield-check"></i>Para Supervisor / BO / Formador</h3>
          <p>Verás una barra de "Modo gestor activo" con un botón para <strong>agregar una nueva
          plantilla</strong>. Al crear o editar una plantilla puedes definir:</p>
          <ul>
            <li>Nombre y descripción.</li>
            <li>El texto del mensaje (incluyendo las variables [NOMBRE_USUARIO], etc. si quieres que sea
            personalizable).</li>
            <li>Un ícono y un color para identificarla visualmente en la lista.</li>
            <li>Una imagen adjunta opcional (por ejemplo, una captura de pantalla de referencia).</li>
          </ul>
          <p>Cada fila también tendrá botones de <strong>editar</strong> (lápiz) y <strong>eliminar</strong>
          (papelera) para mantener la lista actualizada.</p>
        </div>
      `
    },

    {
      id: 'tipificaciones',
      icon: 'ti-tags',
      label: 'Tipificaciones',
      html: `
        <h2><i class="ti ti-tags"></i>Tipificaciones</h2>
        <p class="tut-intro">Es el catálogo oficial de "etiquetas" que se usan para clasificar cada
        atención/caso: qué proceso es, qué tipo de atención (Consulta, Requerimiento o Queja) y a qué cola
        se debe derivar.</p>

        <div class="tut-block">
          <h3><i class="ti ti-category"></i>Categorías y chips</h3>
          <p>Las tipificaciones están agrupadas por <strong>categoría</strong> (por ejemplo: ACCESOS,
          MATRÍCULA, etc.). Arriba verás "chips" (botones redondeados) para filtrar rápidamente por
          categoría — haz clic en uno para ver solo las tipificaciones de esa categoría, o en "Todos" para
          ver todas.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-list-search"></i>Acordeones y búsqueda</h3>
          <p>Cada categoría se muestra como un acordeón (una barra que se expande al hacer clic). Dentro,
          cada tipificación es una tarjeta que también se expande para mostrar el detalle completo: a qué
          proceso/subproceso pertenece, cuándo aplica, qué tipo de atención es (Consulta / Requerimiento /
          Queja), el plazo correspondiente y a qué "cola" se debe derivar el caso.</p>
          <p>Usa la barra de búsqueda para encontrar una tipificación por palabra clave — la búsqueda
          revisa todos los campos (asunto, proceso, subproceso, "aplica cuando", etc.).</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-info-circle"></i>Cómo leer una tipificación</h3>
          <ul>
            <li><strong>Modalidad</strong>: a qué tipo de alumno aplica (Pregrado, Posgrado, Todas, etc.).</li>
            <li><strong>Proceso / Subproceso</strong>: el área específica del trámite (ej: Accesos → MFA).</li>
            <li><strong>Asunto</strong>: el título de la tipificación, lo que vas a registrar en tu BO.</li>
            <li><strong>Aplica cuando…</strong>: la descripción de en qué situación exacta debes usar esta
            tipificación. Léela con cuidado antes de aplicarla a un caso.</li>
            <li><strong>Tipo de atención</strong>: <em>Consulta</em> (información), <em>Requerimiento</em>
            (una acción/trámite que el alumno solicita) o <em>Queja</em> (una inconformidad).</li>
            <li><strong>Plazo</strong>: el tiempo de respuesta/resolución esperado, si aplica.</li>
            <li><strong>Cola(s) de derivación</strong>: a qué cola(s) interna(s) se debe escalar el caso si
            no se resuelve directamente.</li>
          </ul>
        </div>

        <div class="tut-block tut-role-block">
          <h3><i class="ti ti-shield-check"></i>Para Supervisor / BO / Formador</h3>
          <p>Con la barra de "Modo gestor activo" puedes:</p>
          <ul>
            <li><strong>Crear una categoría</strong> nueva (incluso vacía, para irla llenando después).</li>
            <li><strong>Agregar una tipificación</strong> nueva dentro de cualquier categoría, llenando
            todos los campos descritos arriba.</li>
            <li><strong>Editar</strong> cualquier celda directamente haciendo clic sobre ella (edición en
            línea) o usando el botón de lápiz para abrir el formulario completo.</li>
            <li><strong>Eliminar</strong> tipificaciones o categorías completas con el botón de
            papelera.</li>
            <li><strong>Renombrar</strong> una categoría existente.</li>
          </ul>
          <div class="tut-tip"><i class="ti ti-bulb"></i>Cuando edites en línea (haciendo clic directo
          sobre el texto de una celda), recuerda confirmar el cambio — normalmente con <kbd>Enter</kbd> o
          haciendo clic fuera del campo — para que se guarde.</div>
        </div>
      `
    },

    {
      id: 'preguntas',
      icon: 'ti-award',
      label: 'Preguntas frecuentes',
      html: `
        <h2><i class="ti ti-award"></i>Preguntas frecuentes (FAQ)</h2>
        <p class="tut-intro">Es la base de conocimiento del portal: respuestas ya redactadas a las dudas
        más comunes de los alumnos y del propio equipo, organizadas por categoría.</p>

        <div class="tut-block">
          <h3><i class="ti ti-tags"></i>Categorías (chips superiores)</h3>
          <p>Cada chip de color representa una categoría de preguntas (por ejemplo: Matrícula, Accesos,
          Pagos, etc.). Cada chip muestra entre paréntesis cuántas preguntas tiene esa categoría. Haz clic
          en un chip para filtrar, o en "Todos" para ver todas las preguntas.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-search"></i>Búsqueda inteligente</h3>
          <p>La barra de búsqueda usa un motor de búsqueda avanzado que entiende sinónimos y variantes
          típicas del Contact Center (por ejemplo, buscar "clave" también encuentra resultados sobre
          "contraseña" o "acceso"). También tolera errores de tipeo leves.</p>
          <p>Las tarjetas de resultado resaltan en amarillo las palabras que coinciden con tu búsqueda, para
          que identifiques rápido por qué ese resultado apareció.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-eye"></i>Ver el detalle de una pregunta</h3>
          <p>Cada tarjeta muestra la pregunta y una vista previa de la respuesta. Haz clic en la tarjeta
          para abrir el detalle completo, que puede incluir imágenes (capturas de pantalla) y, si la
          pregunta tiene un video tutorial relacionado, un enlace a YouTube.</p>
        </div>

        <div class="tut-block tut-role-block">
          <h3><i class="ti ti-shield-check"></i>Para Supervisor / BO / Formador</h3>
          <p>Puedes crear nuevas preguntas frecuentes, editarlas o eliminarlas. Al crear/editar una pregunta
          puedes definir:</p>
          <ul>
            <li>La categoría (y su color de identificación).</li>
            <li>La pregunta y la respuesta completa.</li>
            <li>Imágenes adjuntas (se comprimen automáticamente antes de subirse, para no ocupar mucho
            espacio).</li>
            <li>Un enlace a video de YouTube como apoyo visual, si aplica.</li>
          </ul>
        </div>
      `
    },

    {
      id: 'herramientas',
      icon: 'ti-tools',
      label: 'Herramientas de trabajo',
      html: `
        <h2><i class="ti ti-tools"></i>Herramientas de trabajo</h2>
        <p class="tut-intro">Es tu acceso directo a todos los sistemas y aplicativos que usas día a día:
        Genesys, Salesforce, Peoplesoft, Trámites BO, Matrícula BO, Aula Virtual, etc.</p>

        <div class="tut-block">
          <h3><i class="ti ti-external-link"></i>Acceder a una herramienta</h3>
          <p>Cada tarjeta es un acceso directo: haz clic sobre ella (o sobre su enlace) para abrir el
          sistema correspondiente en una nueva pestaña.</p>
          <p>Algunas tarjetas muestran, debajo del enlace, las <strong>credenciales</strong> compartidas
          (usuario / contraseña) que se usan para entrar a ese sistema cuando aplica.</p>
          <div class="tut-warn"><i class="ti ti-shield-lock"></i>Las credenciales que aparecen aquí son de
          uso interno del equipo. No las compartas fuera del Contact Center ni las publiques en otros
          medios.</div>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-file-type-pdf"></i>Guía descargable (Aula Virtual Canvas)</h3>
          <p>En esta vista también encontrarás un botón para <strong>descargar una guía en PDF</strong>
          sobre el uso del Aula Virtual / Canvas en modo administrativo, útil cuando necesitas
          revisar o explicar a un alumno cómo navegar su aula virtual.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-file-type-doc"></i>Exportar la lista completa</h3>
          <p>Hay un botón para <strong>descargar la lista completa de herramientas en un archivo Word
          (.docx)</strong>, con nombre, enlace y credenciales — útil para tenerlo a mano sin conexión o para
          imprimir.</p>
        </div>

        <div class="tut-block tut-role-block">
          <h3><i class="ti ti-shield-check"></i>Para Supervisor / BO / Formador</h3>
          <p>Puedes agregar nuevas herramientas, editar las existentes (nombre, URL, ícono, credenciales,
          orden de aparición) o eliminarlas, manteniendo la lista siempre actualizada para todo el
          equipo.</p>
        </div>
      `
    },

    {
      id: 'bo-llamadas',
      icon: 'ti-phone-call',
      label: 'Registro de llamadas',
      html: `
        <h2><i class="ti ti-phone-call"></i>Registro de llamadas (BO)</h2>
        <p class="tut-intro">Aquí se registra cada llamada o gestión de Back Office relacionada a un caso:
        a quién se llamó, qué pasó, y en qué estado quedó.</p>

        <div class="tut-block">
          <h3><i class="ti ti-plus"></i>Crear un nuevo registro</h3>
          <p>Usa el botón <strong>"Nuevo"</strong> para abrir el formulario. Los campos típicos incluyen:</p>
          <ul>
            <li>Nombre del alumno y número de caso/WhatsApp.</li>
            <li>Motivo de la llamada (puedes apoyarte en las Tipificaciones para redactarlo).</li>
            <li>Prioridad: <strong>Bajo</strong>, <strong>Medio</strong> o <strong>Alto</strong> — esto
            cambia el color de la tarjeta para que las urgencias resalten visualmente.</li>
          </ul>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-checkbox"></i>Estado de la llamada</h3>
          <p>Cada tarjeta tiene tres botones de estado:</p>
          <ul>
            <li><strong>Pendiente</strong>: aún no se ha realizado la llamada.</li>
            <li><strong>No contesta</strong>: se intentó llamar pero el alumno no respondió.</li>
            <li><strong>Atendida</strong>: la llamada se realizó y el caso quedó gestionado.</li>
          </ul>
          <p>Puedes agregar una <strong>descripción</strong> de lo conversado en la llamada — esto queda
          guardado como historial del caso.</p>
          <div class="tut-tip"><i class="ti ti-bulb"></i>El contador de "BO Llamadas pendientes" que ves en
          Inicio cuenta todas las tarjetas marcadas como "Pendiente" o "No contesta" de cualquier mes — por
          eso es importante mantener el estado actualizado.</div>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-calendar"></i>Navegación por día y búsqueda global</h3>
          <p>Por defecto ves las llamadas del día actual. Usa las flechas de navegación para moverte entre
          días. Si escribes algo en la barra de búsqueda, el portal cambia automáticamente a modo
          <strong>"búsqueda global"</strong>: deja de filtrar por día y busca en todos los registros, de
          cualquier fecha, que coincidan con lo que escribiste.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-file-export"></i>Exportar reportes</h3>
          <p>Existen botones para exportar los registros del periodo visible a <strong>PDF</strong> (un
          reporte con resumen, gráficos y tabla detallada) o a <strong>Excel</strong>, según lo que
          necesites para tu reporte diario/semanal.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-edit"></i>Editar o eliminar un registro</h3>
          <p>Cada tarjeta tiene botones de <strong>editar</strong> (lápiz, para corregir cualquier dato) y
          <strong>eliminar</strong> (papelera, para borrar el registro por completo — usar con cuidado, esta
          acción no se puede deshacer).</p>
        </div>
      `
    },

    {
      id: 'pendientes',
      icon: 'ti-alert-circle',
      label: 'Casos pendientes',
      html: `
        <h2><i class="ti ti-alert-circle"></i>Casos pendientes</h2>
        <p class="tut-intro">Es el tablero de seguimiento de casos que requieren atención adicional o
        escalamiento — el "pendiente del día" del equipo.</p>

        <div class="tut-block">
          <h3><i class="ti ti-plus"></i>Crear un caso pendiente</h3>
          <p>Usa el botón <strong>"Nuevo"</strong>. Al crear el caso eliges el <strong>tipo</strong>:</p>
          <ul>
            <li><strong>Supervisor</strong>: casos que requieren intervención o validación del
            supervisor.</li>
            <li><strong>Backoffice (BO)</strong>: casos que requieren gestión de Back Office.</li>
          </ul>
          <p>Cada tipo se muestra con un color distinto (rojo para Supervisor, ámbar para Backoffice) tanto
          en el borde de la tarjeta como en una etiqueta ("badge") visible.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-calendar-event"></i>Vista por día y navegación</h3>
          <p>Los casos se organizan por día. Cada bloque de día muestra cuántos casos tiene. El día de hoy
          se resalta en naranja. Usa la navegación de mes/día para revisar pendientes anteriores.</p>
          <p>Igual que en Registro de llamadas, si escribes en la barra de búsqueda se activa el modo
          "búsqueda global" en todos los días.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-toggle-left"></i>Filtros: "Todos" / "Mis alertados"</h3>
          <p>Puedes alternar entre ver <strong>todos</strong> los casos pendientes o solo
          <strong>"Mis alertados"</strong> — los casos que tú marcaste como alertados (ver siguiente
          punto).</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-bell"></i>Marcar como "Alertado" y "Resuelto"</h3>
          <ul>
            <li><strong>Alertado</strong>: indica que ya avisaste / escalaste el caso a quien corresponde.
            La tarjeta se atenúa visualmente y muestra un sello con tu marca de "alertado".</li>
            <li><strong>Resuelto</strong>: indica que el caso ya quedó cerrado. Los casos resueltos se
            mueven a la sección de "Atendidos" y dejan de contar en el contador de pendientes de
            Inicio.</li>
          </ul>
          <div class="tut-tip"><i class="ti ti-bulb"></i>Un caso puede estar "alertado" pero todavía no
          "resuelto" (ya avisaste, pero falta que se resuelva). El contador de Inicio solo baja cuando el
          caso se marca como resuelto.</div>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-message-circle"></i>Comentarios</h3>
          <p>Cada caso tiene una sección de comentarios donde varios miembros del equipo (Asesor, BO,
          Formador, Supervisor — cada uno con su color identificador) pueden ir dejando notas de
          seguimiento. Escribe tu comentario y usa el botón de enviar.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-file-export"></i>Exportar reportes</h3>
          <p>Igual que en Registro de llamadas, puedes exportar el periodo visible a PDF o Excel para
          reportes.</p>
        </div>
      `
    },

    {
      id: 'capacitate',
      icon: 'ti-player-play',
      label: 'Academia SAES',
      html: `
        <h2><i class="ti ti-player-play-filled"></i>Academia SAES (Capacítate)</h2>
        <p class="tut-intro">Es la biblioteca de recursos de formación: videos, presentaciones, PDFs y otros
        documentos para aprender o repasar procesos.</p>

        <div class="tut-block">
          <h3><i class="ti ti-category"></i>Categorías y búsqueda</h3>
          <p>Usa los chips de categoría para filtrar por tema, o la barra de búsqueda para encontrar un
          recurso por título o categoría. El contador "X recursos" te indica cuántos resultados hay con el
          filtro actual.</p>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-video"></i>Tipos de recursos</h3>
          <ul>
            <li><strong>Videos de YouTube</strong>: se reproducen directamente dentro del portal al hacer
            clic en la tarjeta (con miniatura y botón de play).</li>
            <li><strong>Videos de Google Drive</strong>: se abren en un reproductor embebido.</li>
            <li><strong>Documentos (PPT, PDF, Word, Excel)</strong>: cada tipo tiene su propio ícono y
            color de tarjeta. Al hacer clic se abre una vista previa del documento, con un botón para
            <strong>descargarlo</strong>.</li>
          </ul>
        </div>

        <div class="tut-block tut-role-block">
          <h3><i class="ti ti-shield-check"></i>Para Supervisor / BO / Formador</h3>
          <p>La barra de "Modo gestor activo" tiene dos botones:</p>
          <ul>
            <li><strong>"Agregar video"</strong>: registra un nuevo recurso a partir de un enlace de
            YouTube o Google Drive (título, categoría, descripción, enlace).</li>
            <li><strong>"Subir documento"</strong>: sube un archivo PPT, PPTX o PDF (máx. 8 MB) — eliges el
            tipo de documento, título, categoría y descripción, y arrastras o seleccionas el archivo.</li>
          </ul>
          <p>Cada tarjeta también tiene botones de editar y eliminar para mantener la academia
          organizada.</p>
          <div class="tut-warn"><i class="ti ti-alert-triangle"></i>Si al subir un documento aparece una
          advertencia de tamaño, verifica que el archivo no supere el límite indicado (8 MB) — puedes
          comprimirlo o convertirlo a PDF para reducir su peso.</div>
        </div>
      `
    },

    {
      id: 'config',
      icon: 'ti-settings',
      label: 'Configuración',
      html: `
        <h2><i class="ti ti-settings"></i>Configuración</h2>
        <p class="tut-intro">Aquí personalizas la apariencia y el comportamiento del portal según tu gusto.
        Todos los cambios se guardan en tu navegador, así que son personales — no afectan a otros
        usuarios.</p>

        <div class="tut-grid2">
          <div class="tut-block">
            <h3><i class="ti ti-palette"></i>Tema de color</h3>
            <p>Elige entre varios temas de color para resaltar botones, chips y elementos activos del
            portal (naranja por defecto, azul, verde, morado, rojo, rosado, turquesa, etc.).</p>
          </div>
          <div class="tut-block">
            <h3><i class="ti ti-layout"></i>Densidad</h3>
            <p>Cambia cuánto espacio ocupan los elementos: <strong>Compacta</strong> (más información en
            pantalla, espacios reducidos), <strong>Normal</strong> o <strong>Espaciosa</strong> (más aire
            entre elementos, más cómodo para pantallas grandes).</p>
          </div>
          <div class="tut-block">
            <h3><i class="ti ti-text-size"></i>Tamaño de fuente</h3>
            <p>Ajusta el tamaño general del texto: Pequeño, Mediano, Grande o Extra grande — útil según tu
            pantalla o preferencia visual.</p>
          </div>
          <div class="tut-block">
            <h3><i class="ti ti-layout-sidebar-left-collapse"></i>Menú lateral compacto</h3>
            <p>Reduce el menú lateral para que muestre solo íconos (sin texto), dejando más espacio para el
            contenido. Al pasar el cursor sobre un ícono, se muestra su nombre.</p>
          </div>
          <div class="tut-block">
            <h3><i class="ti ti-volume"></i>Sonido de notificaciones</h3>
            <p>Activa o desactiva los sonidos cortos que acompañan a las notificaciones de ranking y
            logros, y a la copia de plantillas/glosarios.</p>
          </div>
          <div class="tut-block">
            <h3><i class="ti ti-corner-down-right"></i>Otras preferencias</h3>
            <p>Encontrarás también opciones como resaltar automáticamente casos de prioridad alta, activar o
            desactivar animaciones (útil si tu equipo es más lento), o cambiar el radio de las esquinas
            (bordes redondeados vs. rectos).</p>
          </div>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-user-circle"></i>Tu perfil</h3>
          <p>En esta vista también verás tu nombre, correo, rol actual y el tiempo que llevas en sesión.</p>
        </div>

        <div class="tut-tip"><i class="ti ti-bulb"></i>Si algo se ve raro después de cambiar varias
        opciones, puedes simplemente recargar la página (F5) — tus preferencias se mantienen guardadas y
        el portal se reorganiza correctamente.</div>
      `
    },

    {
      id: 'notificaciones',
      icon: 'ti-bell',
      label: 'Notificaciones',
      html: `
        <h2><i class="ti ti-bell"></i>Notificaciones (esquina inferior derecha)</h2>
        <p class="tut-intro">El portal usa un sistema de notificaciones flotantes, con estilo de "logro de
        videojuego", para avisarte de cambios importantes sin que tengas que estar revisando cada
        sección.</p>

        <div class="tut-block">
          <h3><i class="ti ti-list"></i>Tipos de notificación</h3>
          <ul>
            <li><strong>Ranking</strong> (moradas/doradas/verdes/naranjas): te avisan cambios en tu posición
            del ranking de Satisfacción. Ver el detalle completo en la sección "Satisfacción / Ranking /
            Logros" de este tutorial.</li>
            <li><strong>Logros</strong> (doradas, ícono 🏆): te avisan cuando desbloqueas uno o varios
            logros nuevos.</li>
            <li><strong>Actualización de datos</strong>: por ejemplo, cuando el supervisor sube un nuevo
            reporte de Genesys, verás una notificación de "Ranking actualizado".</li>
          </ul>
        </div>

        <div class="tut-block">
          <h3><i class="ti ti-hand-click"></i>Interacción</h3>
          <ul>
            <li><strong>Hacer clic</strong> sobre la notificación ejecuta una acción relacionada (por
            ejemplo, abrir el ranking o tus logros) cuando esa notificación lo permite.</li>
            <li><strong>El botón ✕</strong> en la esquina superior derecha de la notificación la cierra
            inmediatamente.</li>
            <li>Si no haces nada, la notificación se cierra sola después de unos segundos (verás una
            pequeña barra de progreso en la parte inferior de la notificación que indica el tiempo
            restante).</li>
            <li>Si llegan varias notificaciones juntas, se muestran en fila y desaparecen una por una.</li>
          </ul>
        </div>

        <div class="tut-tip"><i class="ti ti-volume"></i>Algunas notificaciones reproducen un sonido corto.
        Puedes activar o desactivar este sonido desde Configuración.</div>
      `
    },
  ];

  // ── Estilos e inserción del modal en el DOM ─────────────────────
  function buildModal() {
    if (document.getElementById('tut-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'tut-modal';

    const navHtml = SECTIONS.map((s, i) => `
      <div class="tut-nav-item${i === 0 ? ' active' : ''}" data-tut="${s.id}">
        <i class="ti ${s.icon}"></i><span>${s.label}</span>
      </div>`).join('');

    const sectionsHtml = SECTIONS.map((s, i) => `
      <div class="tut-section${i === 0 ? ' active' : ''}" id="tut-sec-${s.id}">${s.html}</div>`).join('');

    modal.innerHTML = `
      <div id="tut-wrap">
        <div id="tut-head">
          <div id="tut-head-icon"><i class="ti ti-book-2"></i></div>
          <div id="tut-head-text">
            <div id="tut-head-title">Aprende a usar Portal SAES</div>
            <div id="tut-head-sub">Guía completa, paso a paso, de todo el portal</div>
          </div>
          <button id="tut-close" title="Cerrar"><i class="ti ti-x"></i></button>
        </div>
        <div id="tut-body">
          <div id="tut-nav">${navHtml}</div>
          <div id="tut-content">${sectionsHtml}</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Cerrar
    modal.querySelector('#tut-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    // Navegación entre secciones
    modal.querySelectorAll('.tut-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.tut;
        modal.querySelectorAll('.tut-nav-item').forEach(x => x.classList.remove('active'));
        modal.querySelectorAll('.tut-section').forEach(x => x.classList.remove('active'));
        item.classList.add('active');
        const sec = document.getElementById('tut-sec-' + id);
        if (sec) sec.classList.add('active');
        const content = document.getElementById('tut-content');
        if (content) content.scrollTop = 0;
      });
    });
  }

  function openModal(sectionId) {
    buildModal();
    const modal = document.getElementById('tut-modal');
    if (!modal) return;
    if (sectionId) {
      const navItem = modal.querySelector(`.tut-nav-item[data-tut="${sectionId}"]`);
      if (navItem) navItem.click();
    }
    modal.classList.add('open');
  }

  function closeModal() {
    const modal = document.getElementById('tut-modal');
    if (modal) modal.classList.remove('open');
  }

  // Exponer globalmente por si se quiere abrir desde otro botón/notificación
  window._tutAbrir = openModal;

  // ── Conectar la tarjeta de "Accesos directos" en Inicio ─────────
  function bindNavButton() {
    const btn = document.getElementById('tut-home-card');
    if (!btn) { setTimeout(bindNavButton, 300); return; }
    btn.addEventListener('click', () => openModal());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindNavButton);
  } else {
    bindNavButton();
  }

})();
