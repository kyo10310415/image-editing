import { createCanvas, loadImage, registerFont } from 'canvas';

interface EditImageParams {
  imageUrl: string;  // Base64 data URL or HTTP URL
  campaignTitle: string;
  discountRate: number;
  regularPrice: number;
  hardPrice: number;
}

interface TextPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right';
  baseline: 'top' | 'middle' | 'bottom';
}

/**
 * Canvas APIを使用して画像のテキスト部分のみを編集
 * レイアウトとデザインは完全に保持
 */
export async function editImageWithCanvas(params: EditImageParams): Promise<string> {
  const { imageUrl, campaignTitle, discountRate, regularPrice, hardPrice } = params;

  try {
    console.log('Starting Canvas image editing...');
    console.log('Campaign:', campaignTitle);
    console.log('Discount:', discountRate + '%');
    console.log('Prices:', regularPrice, hardPrice);

    // 画像を読み込む
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // 元の画像を描画
    ctx.drawImage(image, 0, 0);

    // 画像サイズに応じてフォントサイズを調整
    const scale = image.width / 1200; // 基準幅1200pxとする

    /**
     * テキスト領域の座標定義
     * 注意: これらの座標は元画像のレイアウトに基づいて調整が必要
     * 以下は一般的な楽天バナーのレイアウトを想定した例
     */

    // 背景色で既存テキストを消去
    const bgColor = '#FFFFFF'; // 白背景（画像に合わせて調整）

    // 1. キャンペーンタイトルエリア（上部中央）
    const titleArea = {
      x: image.width * 0.1,
      y: image.height * 0.05,
      width: image.width * 0.8,
      height: image.height * 0.12
    };

    // 2. 割引率エリア（左上の赤いラベル）
    const discountArea = {
      x: image.width * 0.05,
      y: image.height * 0.20,
      width: image.width * 0.25,
      height: image.height * 0.15
    };

    // 3. レギュラー価格エリア（左下）
    const regularPriceArea = {
      x: image.width * 0.05,
      y: image.height * 0.70,
      width: image.width * 0.40,
      height: image.height * 0.15
    };

    // 4. ハード価格エリア（右下）
    const hardPriceArea = {
      x: image.width * 0.55,
      y: image.height * 0.70,
      width: image.width * 0.40,
      height: image.height * 0.15
    };

    // テキストエリアをクリア（白背景で塗りつぶし）
    ctx.fillStyle = bgColor;
    ctx.fillRect(titleArea.x, titleArea.y, titleArea.width, titleArea.height);
    ctx.fillRect(discountArea.x, discountArea.y, discountArea.width, discountArea.height);
    ctx.fillRect(regularPriceArea.x, regularPriceArea.y, regularPriceArea.width, regularPriceArea.height);
    ctx.fillRect(hardPriceArea.x, hardPriceArea.y, hardPriceArea.width, hardPriceArea.height);

    // フォント設定
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. キャンペーンタイトルを描画
    ctx.fillStyle = '#E60012'; // 楽天レッド
    ctx.font = `bold ${Math.floor(40 * scale)}px Arial, "Noto Sans JP", sans-serif`;
    ctx.fillText(
      campaignTitle,
      titleArea.x + titleArea.width / 2,
      titleArea.y + titleArea.height / 2
    );

    // 2. 割引率を描画
    ctx.fillStyle = '#FFFFFF'; // 白文字
    ctx.font = `bold ${Math.floor(60 * scale)}px Arial`;
    ctx.fillText(
      `${discountRate}% OFF`,
      discountArea.x + discountArea.width / 2,
      discountArea.y + discountArea.height / 2
    );

    // 3. レギュラー価格を描画
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'left';
    ctx.font = `${Math.floor(16 * scale)}px Arial`;
    
    // 元価格（取り消し線）
    const regularOriginalText = '¥4,400 (税込)';
    const regularX = regularPriceArea.x + 20 * scale;
    const regularY1 = regularPriceArea.y + 30 * scale;
    ctx.fillText(regularOriginalText, regularX, regularY1);
    
    // 取り消し線
    const regularTextWidth = ctx.measureText(regularOriginalText).width;
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(regularX, regularY1);
    ctx.lineTo(regularX + regularTextWidth, regularY1);
    ctx.stroke();

    // 割引価格（赤・太字）
    ctx.fillStyle = '#E60012';
    ctx.font = `bold ${Math.floor(24 * scale)}px Arial`;
    const regularY2 = regularY1 + 35 * scale;
    ctx.fillText(`¥${regularPrice.toLocaleString('ja-JP')} (税込)`, regularX, regularY2);

    // 4. ハード価格を描画
    ctx.fillStyle = '#333333';
    ctx.font = `${Math.floor(16 * scale)}px Arial`;
    
    // 元価格（取り消し線）
    const hardOriginalText = '¥4,950 (税込)';
    const hardX = hardPriceArea.x + 20 * scale;
    const hardY1 = hardPriceArea.y + 30 * scale;
    ctx.fillText(hardOriginalText, hardX, hardY1);
    
    // 取り消し線
    const hardTextWidth = ctx.measureText(hardOriginalText).width;
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hardX, hardY1);
    ctx.lineTo(hardX + hardTextWidth, hardY1);
    ctx.stroke();

    // 割引価格（赤・太字）
    ctx.fillStyle = '#E60012';
    ctx.font = `bold ${Math.floor(24 * scale)}px Arial`;
    const hardY2 = hardY1 + 35 * scale;
    ctx.fillText(`¥${hardPrice.toLocaleString('ja-JP')} (税込)`, hardX, hardY2);

    // Canvas を Data URL として返す
    const result = canvas.toDataURL('image/png');
    console.log('Canvas editing completed, result size:', result.length);

    return result;

  } catch (error) {
    console.error('Canvas editing error:', error);
    throw new Error(`Canvas image editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * より高度な編集：座標を動的に検出
 * OCRやテンプレートマッチングで座標を自動検出する場合はここに実装
 */
export async function editImageWithAutoDetection(params: EditImageParams): Promise<string> {
  // TODO: 将来的に座標自動検出機能を実装
  // 現在は固定座標版を使用
  return editImageWithCanvas(params);
}
