# 🏷️ ARREBATAO RP — Sistema de Tickets v2.0

Bienvenido a la documentación oficial del **Sistema Avanzado de Tickets v2** para **ARREBATAO RP** (FiveM / GTA V Roleplay). Este bot ha sido diseñado y optimizado para ofrecer una gestión de soporte eficiente, segura, modular y altamente personalizable dentro de Discord.

---

## 📋 Tabla de Contenidos
1. [Características Principales](#-características-principales)
2. [Requisitos Previos](#-requisitos-previos)
3. [Configuración del Bot en Discord Developer Portal](#-configuración-del-bot-en-discord-developer-portal)
4. [Configuración del Entorno (.env)](#-configuración-del-entorno-env)
5. [Instalación y Despliegue de Comandos](#-instalación-y-despliegue-de-comandos)
6. [Puesta en Marcha (Desarrollo y Producción PM2)](#-puesta-en-marcha-desarrollo-y-producción-pm2)
7. [Uso del Comando `/ticket-panel`](#-uso-del-comando-ticket-panel)
8. [Matriz de Categorías, Canales Padre y Roles de Staff](#-matriz-de-categorías-canales-padre-y-roles-de-staff)
9. [Regla Especial de Jerarquía Superior (Donaciones)](#-regla-especial-de-jerarquía-superior-donaciones)
10. [Botones de Control dentro del Ticket](#-botones-de-control-dentro-del-ticket)
11. [Política de Límites y Protección Anti-Spam](#-política-de-límites-y-protección-anti-spam)
12. [Estructura del Proyecto](#-estructura-del-proyecto)
13. [Solución de Problemas (Troubleshooting)](#-solución-de-problemas-troubleshooting)

---

## 🚀 Características Principales

- **11 Categorías Especializadas:** Formulario modal independiente para cada tipo de gestión con preguntas adaptadas a la normativa del servidor.
- **Doble Método de Selección:** Botones de acceso rápido para las 4 gestiones más solicitadas y menú desplegable (*Select Menu*) con las 11 categorías.
- **Transcripciones HTML Interactivas:** Generación de copias completas de la conversación con diseño idéntico a Discord, adjuntos, imágenes y avatares mediante `discord-html-transcripts`.
- **Canal de Logs Centralizado:** Registro automático de creación de tickets, transcripciones y archivado de cierres con mención del staff responsable.
- **Notificaciones al Usuario:** Envío automático de la transcripción HTML por Mensaje Directo (DM) al usuario al finalizar su ticket.
- **Control de Inactividad y Reclamación:** Botón para reclamar tickets individualmente e impedir duplicación de staff, además de botón de alerta de inactividad.
- **Permisos Dinámicos y Jerárquicos:** Concesión automática de permisos al rol correspondiente y herencia de roles superiores en categorías exclusivas como Donaciones.
- **Protección Anti-Spam Estricta:** Límite máximo de 2 tickets totales por usuario y 1 ticket por categoría simultánea.

---

## 📦 Requisitos Previos

1. **Node.js:** Versión `18.0.0` o superior (se recomienda Node.js LTS v20 o v22).
2. **NPM:** Gestor de paquetes incluido con Node.js (`npm -v`).
3. **Cuenta de Discord y Servidor:** Permisos de Administrador en el servidor de Discord de ARREBATAO RP.

---

## 🤖 Configuración del Bot en Discord Developer Portal

Para que el bot funcione correctamente, debes configurar los permisos e intents requeridos en el [Discord Developer Portal](https://discord.com/developers/applications):

1. **Crear o Seleccionar la Aplicación:**
   - Dirígete a la pestaña **Applications** y selecciona o crea la aplicación del bot de ARREBATAO RP.
2. **Habilitar Intents Privilegiados (OBLIGATORIO):**
   - Ve a la sección **Bot** en el menú izquierdo.
   - Desplázate hacia abajo hasta **Privileged Gateway Intents** y activa los siguientes interruptores:
     - ✅ **Server Members Intent** (`GUILD_MEMBERS`): Necesario para consultar miembros, roles y jerarquías.
     - ✅ **Message Content Intent** (`MESSAGE_CONTENT`): Necesario para leer el contenido de mensajes y generar las transcripciones HTML completas.
   - Haz clic en **Save Changes**.
3. **Obtener Token del Bot:**
   - En la misma pestaña **Bot**, haz clic en **Reset Token**, copia la clave generada y guárdala de forma segura (será tu `DISCORD_TOKEN`).
4. **Obtener Client ID:**
   - En el menú izquierdo, ve a **General Information**.
   - Copia el campo **Application ID** (será tu `CLIENT_ID`).
5. **Invitar al Bot al Servidor:**
   - Ve a **OAuth2** -> **URL Generator**.
   - En **Scopes**, marca: `bot` y `applications.commands`.
   - En **Bot Permissions**, selecciona: `Administrator` (o en su defecto: *Manage Channels*, *Manage Roles*, *View Channels*, *Send Messages*, *Embed Links*, *Attach Files*, *Read Message History*, *Add Reactions*).
   - Copia la URL generada, ábrela en tu navegador e invita al bot al servidor de Discord de ARREBATAO RP.
6. **Posición del Rol del Bot en Discord:**
   - En tu servidor de Discord, ve a **Ajustes del Servidor** -> **Roles**.
   - Asegúrate de que el rol asignado al bot esté **por encima** de los roles que debe gestionar y por encima de los usuarios estándar, para poder modificar sobreescrituras de permisos en los canales.

---

## ⚙️ Configuración del Entorno (.env)

El proyecto incluye un archivo modelo llamado `.env.example`. Crea tu archivo `.env` definitivo siguiendo estos pasos:

### 1. Crear el archivo `.env`
En la raíz del proyecto (`c:\Users\desco\Documents\ARREBATAO RP`), ejecuta en tu consola:
```powershell
copy .env.example .env
```

### 2. Obtener los IDs necesarios en Discord
Para copiar IDs en Discord, activa el Modo Desarrollador:
> **Ajustes de Usuario** -> **Avanzado** -> Activar **Modo Desarrollador**.

- **`DISCORD_TOKEN`**: Obtenido en el portal de desarrolladores (sección Bot).
- **`CLIENT_ID`**: Obtenido en el portal de desarrolladores (sección General Information -> Application ID).
- **`GUILD_ID`**: Haz clic derecho sobre el ícono de tu servidor de ARREBATAO RP y selecciona **Copiar ID del servidor**.
- **`LOGS_CHANNEL_ID`**: Crea un canal de texto privado (ej. `#logs-tickets`), haz clic derecho sobre él y selecciona **Copiar ID del canal**.

### 3. Estructura final del `.env`
Edita el archivo `.env` con tus valores reales:
```ini
# Configuración del Bot de Discord
DISCORD_TOKEN=MTE5OTkzOD...TU_TOKEN_COMPLETO_AQUI
CLIENT_ID=134988776655443322
GUILD_ID=1530124413687566437

# Canal para registros y transcripciones de tickets
LOGS_CHANNEL_ID=1530124703606509668
```

---

## 🚀 Instalación y Despliegue de Comandos

### 1. Instalar Dependencias
Si aún no has instalado los paquetes de Node:
```powershell
npm install
```

### 2. Registrar los Comandos Slash (Deploy)
Antes de iniciar el bot o tras modificar la definición de comandos, debes sincronizarlos con la API de Discord:
```powershell
npm run deploy
```
*Salida esperada:*
```text
[DEPLOY] Comando cargado: /ping
[DEPLOY] Comando cargado: /ticket-panel
[DEPLOY] Iniciando actualización de 2 comando(s) slash (/)
[DEPLOY] ¡Éxito! Se registraron 2 comando(s) en la guild 1530124413687566437.
```
> **Nota:** Al usar `GUILD_ID` en el `.env`, la sincronización de comandos es **instantánea**. Si se omite, el despliegue es global y puede demorar hasta 1 hora en propagarse.

---

## 🖥️ Puesta en Marcha (Desarrollo y Producción PM2)

### Modo Desarrollo / Ejecución Directa
Para pruebas locales o depuración:
```powershell
npm start
```
O directamente con Node:
```powershell
node src/index.js
```

### Modo Producción 24/7 con PM2 (Recomendado para FiveM)
En entornos de producción para servidores FiveM, se recomienda utilizar el gestor de procesos **PM2**. Permite que el bot se mantenga encendido 24/7, reinicie automáticamente ante fallos o tras reinicios del servidor dedicado:

1. **Instalar PM2 globalmente (si no lo tienes):**
   ```powershell
   npm install -g pm2
   ```

2. **Iniciar el Bot con PM2:**
   ```powershell
   pm2 start src/index.js --name "arrebatao-tickets"
   ```

3. **Comandos Útiles de Gestión:**
   - Ver estado del bot: `pm2 status`
   - Ver logs en vivo: `pm2 logs arrebatao-tickets`
   - Reiniciar el bot: `pm2 restart arrebatao-tickets`
   - Detener el bot: `pm2 stop arrebatao-tickets`
   - Guardar lista de procesos para el arranque del sistema: `pm2 save`

---

## 🕹️ Uso del Comando `/ticket-panel`

El comando `/ticket-panel` publica el mensaje institucional interactivo con el banner oficial (`assets/banner.jpg`), los botones rápidos y el menú desplegable.

### Sintaxis
```text
/ticket-panel [canal]
```

### Parámetros
- **`canal`** *(Opcional)*: Canal de texto donde deseas que se envíe el panel (por ejemplo: `#abrir-ticket`). Si no se especifica, se publicará en el canal donde se ejecutó el comando.

### Requisitos de Permiso
- Solo miembros con permiso de **Administrador** pueden ejecutar este comando.
- El bot debe tener permisos de **Ver Canal**, **Enviar Mensajes**, **Insertar Enlaces** y **Adjuntar Archivos** en el canal de destino.

---

## 📊 Matriz de Categorías, Canales Padre y Roles de Staff

El bot cuenta con 11 categorías preconfiguradas con sus respectivas categorías de Discord (canales padre), prefijo de canal y roles de Staff asignados:

| # | Categoría | Emoji | Prefijo Canal | ID Categoría Discord (Padre) | ID Rol(es) de Staff Asignados | Jerarquía Especial |
|---|-----------|:-----:|:-------------:|:----------------------------:|:------------------------------:|:------------------:|
| 1 | **Soporte General** | 🔧 | `soporte-` | `1530124703606509668` | `1530124436059983922` | Estándar |
| 2 | **Reportes de Jugadores** | 🚨 | `reporte-` | `1530124706169094195` | `1530124436059983922` | Estándar |
| 3 | **Apelación de Sanciones** | ⚖️ | `apelacion-` | `1530124708605853786` | `1542655847547666612` | Estándar |
| 4 | **Donaciones & Tienda VIP** | 💎 | `donacion-` | `1530124710820577421` | `1530124417244598312` | ⭐ **Jerarquía Superior** |
| 5 | **Organizaciones Ilegales** | 👑 | `org-` | `1530124713316188170` | `1530124443664253138`<br>`1530124441928077312`<br>`1530124440199757934` | Estándar |
| 6 | **Reclamos & Devoluciones** | 📦 | `reclamo-` | `1530124715652288633` | `1530124417244598312` | Estándar |
| 7 | **Solicitud de CK** | 💀 | `ck-` | `1530124718567325766` | `1530124427885543554`<br>`1549085104876421212`<br>`1542655847547666612` | Estándar |
| 8 | **Reportar Staff** | 🛡️ | `rep-staff-` | `1530124721516183632` | `1530124423397380166` | Estándar |
| 9 | **Rango Streamer** | 🎥 | `streamer-` | `1530124723898286202` | `1548133950814290010` | Estándar |
| 10 | **Negocios & Empresas** | 💼 | `negocio-` | `1530978495658852353` | `1530124413687566437` | Estándar |
| 11 | **Postulaciones** | 📝 | `postulacion-` | `1545513352472559766` | `1545513352472559766` | Estándar |

---

## 👑 Regla Especial de Jerarquía Superior (Donaciones)

En la categoría **Donaciones & Tienda VIP**, se encuentra habilitada la opción `higherRolesAllowed: true`.

### ¿Cómo funciona?
1. El rol base configurado es `1530124417244598312` (*Encargado de Donaciones*).
2. El sistema analiza dinámicamente la posición del rol (`role.position`) en el servidor de Discord.
3. **Cualquier rol que se encuentre en una posición igual o superior a la del rol base** (por ejemplo: *Directores*, *Co-Fundadores*, *Fundadores / Dueños*) recibirá permisos de lectura y escritura de forma automática en el ticket, sin necesidad de agregarlos manualmente uno por uno.
4. Los roles gestionados por bots o integraciones quedan automáticamente excluidos para mantener la privacidad y seguridad.

---

## 🛠️ Botones de Control dentro del Ticket

Cada ticket creado incluye en su mensaje de bienvenida una barra interactiva de 4 botones de control:

```
[ 🔒 Cerrar Ticket ]  [ ✋ Reclamar Ticket ]  [ 🔔 Notificar Usuario ]  [ 📄 Transcripción ]
```

### 1. 🔒 Cerrar Ticket (`ticket_control_close`)
- **Acción:** Al pulsarlo, se despliega una ventana modal interactiva solicitando el **Motivo del Cierre**.
- **Flujo de cierre:**
  1. Registra el motivo indicado por el Staff.
  2. Genera automáticamente el archivo HTML completo de la transcripción.
  3. Envía un registro detallado al canal de logs (`LOGS_CHANNEL_ID`) con el motivo, staff que cerró, creador y el archivo adjunto.
  4. Envía un mensaje directo (DM) al usuario creador con el archivo de transcripción y el motivo.
  5. Inicia una cuenta regresiva de 5 segundos con mensaje informativo en el canal y lo elimina de manera segura.

### 2. ✋ Reclamar Ticket (`ticket_control_claim`)
- **Acción:** Permite a un miembro del Staff asignarse la responsabilidad del caso.
- **Efecto:**
  - El botón cambia de color verde a gris secundario y muestra el texto `Reclamado por {nombre_staff}`.
  - El botón queda inhabilitado (*disabled*) para que ningún otro miembro pueda sobreescribir la asignación.
  - Envía un mensaje visible en el canal informando al usuario quién lo atenderá.

### 3. 🔔 Notificar Usuario (`ticket_control_notify`)
- **Acción:** Diseñado para casos donde el usuario no responde.
- **Efecto:** Envía una alerta formal en el canal con mención directa al creador del ticket, solicitándole que proporcione la información requerida o advirtiéndole que el ticket podrá ser cerrado por inactividad.

### 4. 📄 Transcripción (`ticket_control_transcript`)
- **Acción:** Generación de transcripción bajo demanda sin necesidad de cerrar el ticket.
- **Efecto:** Crea el archivo interactivo `.html` al instante y lo sube directamente al canal y al canal de logs para auditorías o revisiones intermedias.

---

## 🛡️ Política de Límites y Protección Anti-Spam

Para evitar abusos, saturación del canal o aperturas masivas accidentales por parte de usuarios, el sistema incorpora dos filtros automáticos:

1. **Límite Total de Tickets Activos:**
   - Un usuario solo puede tener un máximo de **2 tickets abiertos simultáneamente** en todo el servidor (`maxTicketsPerUser: 2`).
2. **Límite por Categoría:**
   - Un usuario solo puede tener un máximo de **1 ticket abierto por categoría** (`maxTicketsPerCategory: 1`). Si ya posee un ticket en *Soporte General*, no podrá abrir otro en esa misma categoría hasta concluir el anterior.
3. **Respuesta Informativa:**
   - Si el usuario intenta abrir un ticket superando estos límites, la interacción es rechazada de inmediato mediante un mensaje efímero privado que incluye el enlace directo a sus canales de tickets activos (`<#channel_id>`).

---

## 📁 Estructura del Proyecto

```text
ARREBATAO RP/
├── assets/
│   └── banner.jpg               # Imagen de cabecera oficial para el panel de tickets
├── src/
│   ├── commands/
│   │   ├── ping.js              # Comando /ping de latencia y estado
│   │   └── ticket-panel.js      # Comando /ticket-panel para desplegar el panel
│   ├── config/
│   │   └── config.js            # Configuración de 11 categorías, modales, colores e IDs
│   ├── events/
│   │   ├── interactionCreate.js # Enrutador central de comandos, botones, selects y modales
│   │   └── ready.js             # Evento de inicio y presencia del bot
│   ├── handlers/
│   │   ├── ticketControlHandler.js # Lógica de cierre, reclamar, notificar y transcripciones
│   │   └── ticketModalHandler.js   # Lógica de límites, modales y creación de canales
│   ├── utils/
│   │   ├── embedBuilder.js      # Constructores de embeds y componentes interactivos
│   │   └── permissions.js       # Cálculo de permisos dinámicos y jerarquías
│   ├── deploy-commands.js       # Script de registro de slash commands en Discord API
│   └── index.js                 # Punto de entrada principal y conexión del bot
├── .env.example                 # Plantilla de variables de entorno
├── .gitignore                   # Archivos excluidos del control de versiones (node_modules, .env)
├── package.json                 # Configuración de dependencias y scripts de npm
└── README.md                    # Documentación completa del proyecto
```

---

## ❓ Solución de Problemas (Troubleshooting)

### 1. `[AUTH ERROR] Token no encontrado en las variables de entorno`
- **Causa:** El archivo `.env` no existe o no tiene definida la variable `DISCORD_TOKEN`.
- **Solución:** Copia `.env.example` a `.env` y coloca el token de tu bot sin espacios ni comillas.

### 2. `Missing Access` o `Missing Permissions` al crear canales
- **Causa:** El rol del bot en Discord no tiene permisos para crear canales o administrar roles, o su rol se encuentra por debajo de la categoría padre.
- **Solución:** Ve a *Ajustes del Servidor* -> *Roles* y sube el rol del bot por encima de los roles de los usuarios. Asegúrate de que tenga permiso de **Administrador** o **Gestionar Canales** y **Gestionar Permisos**.

### 3. Las transcripciones no muestran el texto de los mensajes
- **Causa:** No se activó el **Message Content Intent**.
- **Solución:** Ve a [Discord Developer Portal](https://discord.com/developers/applications) -> Tu App -> **Bot** -> activa **Message Content Intent** y guarda los cambios.

### 4. Los comandos `/` no aparecen en el servidor
- **Causa:** No se ejecutó el script de despliegue o el `CLIENT_ID`/`GUILD_ID` son incorrectos.
- **Solución:** Ejecuta en la terminal `npm run deploy` y verifica que los IDs en el `.env` coincidan exactamente con tu servidor.

---

<p align="center">
  <b>ARREBATAO RP</b> • Desarrollado para la mejor experiencia de Roleplay.<br>
  <i>Sistema de Tickets v2.0 — Todos los derechos reservados.</i>
</p>
