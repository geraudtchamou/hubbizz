"""
Image Optimization Service
Compress and optimize images for low-bandwidth African markets
"""

import aiohttp
from typing import Optional, List
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

# Target sizes for different use cases
THUMBNAIL_SIZE = (200, 200)  # For search results
LOGO_SIZE = (300, 300)  # For business logos
GALLERY_SIZE = (800, 600)  # For gallery images
MAX_FILE_SIZE_KB = 100  # Target max file size for thumbnails

async def optimize_image_url(
    image_url: str,
    target_size: tuple = THUMBNAIL_SIZE,
    quality: int = 75,
    format: str = "WEBP"
) -> Optional[str]:
    """
    Fetch, compress, and return optimized image URL or data URI
    
    Optimizations:
    - Resize to target dimensions
    - Convert to WebP format (better compression than JPEG/PNG)
    - Reduce quality for faster loading
    - Cache at edge (Cloudflare)
    
    Returns optimized image as data URI for offline PWA support
    """
    
    if not image_url:
        return None
    
    try:
        # Check if already a data URI
        if image_url.startswith('data:'):
            return image_url
        
        # Fetch image
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url, timeout=10) as response:
                if response.status != 200:
                    logger.warning(f"Failed to fetch image: {image_url}")
                    return image_url  # Return original on failure
                
                image_data = await response.read()
        
        # Optimize image
        optimized_data = await _optimize_image(
            image_data,
            target_size=target_size,
            quality=quality,
            format=format
        )
        
        # Convert to data URI for offline support
        mime_type = f"image/{format.lower()}"
        import base64
        data_uri = f"data:{mime_type};base64,{base64.b64encode(optimized_data).decode()}"
        
        return data_uri
    
    except Exception as e:
        logger.error(f"Image optimization failed: {e}")
        return image_url  # Return original on error

async def _optimize_image(
    image_data: bytes,
    target_size: tuple,
    quality: int,
    format: str
) -> bytes:
    """Optimize image with Pillow"""
    
    # Open image
    img = Image.open(io.BytesIO(image_data))
    
    # Convert to RGB if necessary (for PNG with transparency)
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    
    # Resize with smart cropping
    img.thumbnail(target_size, Image.Resampling.LANCZOS)
    
    # Save optimized
    buffer = io.BytesIO()
    img.save(
        buffer,
        format=format,
        quality=quality,
        optimize=True,
        progressive=True
    )
    
    optimized_data = buffer.getvalue()
    
    # Check file size and reduce quality if needed
    if len(optimized_data) > MAX_FILE_SIZE_KB * 1024 and quality > 50:
        logger.debug("Reducing quality to meet size target")
        return await _optimize_image(
            image_data,
            target_size,
            quality - 10,
            format
        )
    
    return optimized_data

def generate_thumbnail(image_data: bytes, size: tuple = THUMBNAIL_SIZE) -> bytes:
    """Generate thumbnail from image data (synchronous version)"""
    
    img = Image.open(io.BytesIO(image_data))
    img.thumbnail(size, Image.Resampling.LANCZOS)
    
    buffer = io.BytesIO()
    img.save(buffer, format='WEBP', quality=75, optimize=True)
    
    return buffer.getvalue()

async def optimize_images_batch(
    image_urls: List[str],
    target_size: tuple = GALLERY_SIZE
) -> List[Optional[str]]:
    """Optimize multiple images concurrently"""
    
    import asyncio
    
    tasks = [
        optimize_image_url(url, target_size=target_size)
        for url in image_urls
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle exceptions gracefully
    optimized = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Failed to optimize image {i}: {result}")
            optimized.append(image_urls[i])  # Return original on failure
        else:
            optimized.append(result)
    
    return optimized

def get_image_dimensions(image_data: bytes) -> tuple:
    """Get image dimensions without loading full image"""
    
    img = Image.open(io.BytesIO(image_data))
    return img.size

def calculate_compression_ratio(original_size: int, optimized_size: int) -> float:
    """Calculate compression ratio percentage"""
    
    if original_size == 0:
        return 0.0
    
    reduction = ((original_size - optimized_size) / original_size) * 100
    return round(reduction, 2)
