# Word & Words

Un juego de palabras multijugador en tiempo real inspirado en Scrabble, construido con tecnologías web modernas.

## 🚀 Características

-   **Multijugador en Tiempo Real**: Juega contra amigos o extraños usando WebSockets.
-   **Multi-idioma**: Soporte completo para **Español**, **Català** e **English**.
-   **Diseño Moderno**: Interfaz "Glassmorphism" limpia, animaciones suaves y diseño totalmente responsivo (móvil y escritorio).
-   **Reglas Flexibles**: Opciones para límite de tiempo, "Modo Estricto" (penalización por palabras inválidas), y más.
-   **Chat y Emotes**: Comunícate con tus oponentes durante la partida.

## � Capturas de Pantalla

<p align="center">
  <img src="docs/screenshots/desktop-view.png" alt="Vista de Escritorio" width="45%">
  <img src="docs/screenshots/mobile-view.png" alt="Vista Móvil" width="45%">
</p>

## 📱 Diseño Responsivo

Word & Words ha sido diseñado meticulosamente para funcionar en cualquier dispositivo:

-   **Escritorio**: Disfruta de una experiencia amplia con barra lateral, chat visible y tablero de alta resolución.
-   **Móvil**: La interfaz se adapta automáticamente:
    -   El tablero maximiza el espacio vertical disponible.
    -   Los menús y el chat se mueven a paneles accesibles (drawer/modal).
    -   Controles táctiles optimizados (arrastrar y soltar, tocar para colocar, pellizcar para zoom).

## �🛠️ Stack Tecnológico

### Cliente (Frontend)
-   **React** (Vite): Framework principal.
-   **Socket.IO Client**: Para comunicación en tiempo real.
-   **CSS Modules**: Estilos modulares y mantenibles.
-   **Canvas Confetti**: Efectos de celebración.

### Servidor (Backend)
-   **Node.js & Express**: Servidor API.
-   **Socket.IO**: Motor de juego en tiempo real.
-   **Motor de Juego Personalizado**: Lógica de validación de tablero, puntuación y gestión de turnos.

## 📦 Quick Start (Docker Hub) - Recomendado

La forma más rápida de jugar es usar la imagen pre-construida de Docker Hub. Solo necesitas Docker instalado.

```bash
docker run -d -p 8080:80 \
  -v ./data:/app/data \
  --name wordandwords \
  borborbor/wordandwords:latest
```

O si prefieres usar **Docker Compose** (crea un archivo `docker-compose.yml`):

```yaml
services:
  wordandwords:
    image: borborbor/wordandwords:latest
    container_name: wordandwords
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./data:/app/data
      # Opcional: Persistir diccionarios personalizados
      - ./dictionaries:/app/server/dictionaries
```

Luego ejecuta: `docker-compose up -d`

El juego estará disponible en: http://localhost:8080

---

## 🛠️ Desarrollo y Build Manual

### Requisitos Previos
-   Node.js v18+
-   Git

### 1. Clonar y Configurar
```bash
git clone https://github.com/borborborja/wordandwords.git
cd wordandwords
```

### 2. Ejecutar con Docker (Build Local)
Si quieres modificar el código y construir tu propia imagen:
```bash
docker-compose up -d --build
```

### 3. Ejecutar en Entorno de Desarrollo (Sin Docker)
```bash
# Servidor
cd server
npm install
npm run dev

# Cliente (en otra terminal)
cd ../client
npm install
npm run dev
```

## 📖 Cómo Jugar

1.  **Crear Sala**: Elige idioma, nombre de jugador y configuraciones (tiempo, etc.).
2.  **Invitar**: Comparte el código de sala con tu amigo.
3.  **Jugar**:
    -   Arrastra fichas al tablero.
    -   La primera palabra debe pasar por la estrella central (★).
    -   Palabras siguientes deben conectar con las existentes.
    -   ¡Usa las casillas especiales (DL, TL, DW, TW) para multiplicar tu puntuación!

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor, abre un "Issue" o "Pull Request" para discutir cambios mayores.

## 📄 Licencia

MIT
