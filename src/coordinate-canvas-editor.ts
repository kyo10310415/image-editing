import { createCanvas, loadImage } from 'canvas';

interface EditImageWithCoordinatesParams {
  imageUrl: string;
  campaignTitle: string;
  discountRate: number;
  regularPrice: number;
  hardPrice: number;
  coordinates: {
    campaign?: { x: number; y: number; width: number; height: number } | null;
    discount?: { x: number; y: number; width: number; height: number } | null;
    regularPrice?: { x: number; y: number; width: number; height: number } | null;
    hardPrice?: { x: number; y: number; width: number; height: number } | null;
  };
}

/**
 * ユーザー指定の座標を使って画像編集（最も正確）
 */
export async function editImageWithUserCoordinates(params: EditImageWithCoordinatesParams): Promise<string> {
  const { imageUrl, campaignTitle, discountRate, regularPrice, hardPrice, coordinates } = params;

  try {
    console.log('🎯 Editing with user-specified coordinates...');
    console.log('Campaign:', campaignTitle);
    console.log('Discount:', discountRate + '%');
    console.log('Prices:', regularPrice, hardPrice);
    console.log('Coordinates:', JSON.stringify(coordinates));

    // 画像を読み込む
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // 元の画像を描画
    ctx.drawImage(image, 0, 0);

    console.log('📐 Image dimensions:', image.width, 'x', image.height);

    // 各領域を編集
    const areas = [
      { key: 'campaign', value: campaignTitle, type: 'title' },
      { key: 'discount', value: `${discountRate}% OFF`, type: 'discount' },
      { key: 'regularPrice', value: `¥${regularPrice.toLocaleString('ja-JP')}`, type: 'price' },
      { key: 'hardPrice', value: `¥${hardPrice.toLocaleString('ja-JP')}`, type: 'price' }
    ];

    for (const area of areas) {
      const coord = coordinates[area.key as keyof typeof coordinates];
      
      if (!coord) {
        console.warn(`⚠️ No coordinates for ${area.key}, skipping`);
        continue;
      }

      console.log(`✏️ Editing ${area.key} at (${coord.x}, ${coord.y})`);

      // 背景色を抽出（領域の周囲からサンプリング）
      const bgColor = extractBackgroundColor(ctx, coord);
      console.log(`  Background color: rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`);

      // 余白を追加（少し大きめに塗りつぶし）
      const padding = 5;
      ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
      ctx.fillRect(
        coord.x - padding,
        coord.y - padding,
        coord.width + padding * 2,
        coord.height + padding * 2
      );

      // テキストを描画
      drawTextInArea(ctx, area, coord, bgColor);
    }

    const result = canvas.toDataURL('image/png');
    console.log('✅ User-coordinate editing completed');
    console.log('📊 Result size:', result.length, 'characters');

    return result;

  } catch (error) {
    console.error('❌ User-coordinate editing error:', error);
    throw new Error(`User-coordinate editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 背景色を抽出
 */
function extractBackgroundColor(ctx: any, area: { x: number; y: number; width: number; height: number }): { r: number; g: number; b: number } {
  try {
    // 領域の四隅からサンプリング
    const samplePoints = [
      { x: Math.max(0, area.x - 5), y: Math.max(0, area.y - 5) },
      { x: Math.min(ctx.canvas.width - 1, area.x + area.width + 5), y: Math.max(0, area.y - 5) },
      { x: Math.max(0, area.x - 5), y: Math.min(ctx.canvas.height - 1, area.y + area.height + 5) },
      { x: Math.min(ctx.canvas.width - 1, area.x + area.width + 5), y: Math.min(ctx.canvas.height - 1, area.y + area.height + 5) }
    ];

    const colors: Array<{ r: number; g: number; b: number }> = [];

    for (const point of samplePoints) {
      try {
        const imageData = ctx.getImageData(point.x, point.y, 1, 1);
        const data = imageData.data;
        colors.push({ r: data[0], g: data[1], b: data[2] });
      } catch (e) {
        // サンプリングポイントが範囲外の場合はスキップ
      }
    }

    if (colors.length === 0) {
      // デフォルト色（白）
      return { r: 255, g: 255, b: 255 };
    }

    // 平均色を計算
    const avgColor = {
      r: Math.round(colors.reduce((sum, c) => sum + c.r, 0) / colors.length),
      g: Math.round(colors.reduce((sum, c) => sum + c.g, 0) / colors.length),
      b: Math.round(colors.reduce((sum, c) => sum + c.b, 0) / colors.length)
    };

    return avgColor;
  } catch (error) {
    console.warn('Background color extraction failed:', error);
    return { r: 255, g: 255, b: 255 }; // デフォルト白
  }
}

/**
 * テキストを領域内に描画
 */
function drawTextInArea(
  ctx: any,
  area: { key: string; value: string; type: string },
  coord: { x: number; y: number; width: number; height: number },
  bgColor: { r: number; g: number; b: number }
) {
  // 背景の明度から文字色を決定
  const brightness = (bgColor.r * 299 + bgColor.g * 587 + bgColor.b * 114) / 1000;
  const textColor = brightness > 128 ? '#333333' : '#FFFFFF';
  const accentColor = '#E60012'; // 楽天レッド

  // フォントサイズを領域サイズに応じて調整
  const baseFontSize = Math.min(coord.height * 0.6, coord.width / (area.value.length * 0.5));
  const fontSize = Math.max(12, Math.min(100, baseFontSize));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (area.type) {
    case 'title':
      // キャンペーンタイトル
      ctx.fillStyle = brightness > 128 ? '#333333' : '#FFFFFF';
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillText(area.value, coord.x + coord.width / 2, coord.y + coord.height / 2);
      break;

    case 'discount':
      // 割引率（通常は赤ラベル内なので白文字）
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontSize}px Arial`;
      
      // "20% OFF" の場合、2行に分ける
      const parts = area.value.split(' ');
      if (parts.length === 2) {
        const numFontSize = fontSize * 1.3;
        const textFontSize = fontSize * 0.7;
        
        ctx.font = `bold ${numFontSize}px Arial`;
        ctx.fillText(parts[0], coord.x + coord.width / 2, coord.y + coord.height / 2 - fontSize * 0.3);
        
        ctx.font = `bold ${textFontSize}px Arial`;
        ctx.fillText(parts[1], coord.x + coord.width / 2, coord.y + coord.height / 2 + fontSize * 0.4);
      } else {
        ctx.fillText(area.value, coord.x + coord.width / 2, coord.y + coord.height / 2);
      }
      break;

    case 'price':
      // 価格（赤字、太字、左寄せ）
      ctx.fillStyle = accentColor;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(area.value, coord.x + 10, coord.y + coord.height / 2);
      break;
  }
}
