import httpx
import io
from PIL import Image


async def download_image(url: str) -> bytes:
    """Download image from URL with timeout."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


def convert_to_rgb(image_bytes: bytes) -> bytes:
    """Convert any image format to RGB PNG bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    # Handle RGBA/P/CMYK etc.
    if img.mode not in ("RGB",):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG", dpi=(300, 300))
    return buf.getvalue()
