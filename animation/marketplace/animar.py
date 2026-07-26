import cv2
import numpy as np

def animar_obra(image_path, output_path="arte_animado.mp4", fps=30, duracion_seg=4):
    # 1. Cargar la imagen original
    img = cv2.imread(image_path)
    if img is None:
        print("Error: No se encontró la imagen. Revisa la ruta.")
        return

    alto, ancho, _ = img.shape
    centro = (ancho // 2, alto // 2)
    total_frames = fps * duracion_seg

    # Configurar el escritor de video MP4
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (ancho, alto))

    # 2. Máscara para detectar los trazos claros / círculos
    # Convertimos a escala de grises para aislar las líneas brillantes
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Umbralizado adaptable o directo para capturar los trazos claros
    _, mask_circulos = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)
    
    # Suavizar los bordes de la máscara para un acabado orgánico
    mask_circulos = cv2.GaussianBlur(mask_circulos, (7, 7), 0)
    mask_3ch = cv2.cvtColor(mask_circulos, cv2.COLOR_GRAY2BGR) / 255.0

    # Separar fondo (aproximado) y capa de trazos
    capa_circulos = (img * mask_3ch).astype(np.uint8)
    fondo_estatico = (img * (1.0 - mask_3ch)).astype(np.uint8)

    print(f"Generando animación de {total_frames} cuadros...")

    # 3. Generar el bucle de animación
    for i in range(total_frames):
        # Ángulo de rotación continuo (360 grados en el tiempo total)
        angulo = (i / total_frames) * 360.0
        
        # Matriz de rotación
        M = cv2.getRotationMatrix2D(centro, angulo, scale=1.0)
        
        # Rotar la capa de los círculos
        circulos_rotados = cv2.warpAffine(
            capa_circulos, 
            M, 
            (ancho, alto), 
            flags=cv2.INTER_LINEAR, 
            borderMode=cv2.BORDER_REFLECT
        )

        # Recombina el fondo fijo con los círculos en movimiento
        # Usamos blend máximo para mantener la riqueza visual
        frame_final = cv2.addWeighted(fondo_estatico, 0.85, circulos_rotados, 0.95, 0)

        out.write(frame_final)

    out.release()
    print(f"¡Listo! Tu animación se guardó en: {output_path}")

# Ejecutar el proceso
animar_obra("arte_circulos.jpg")