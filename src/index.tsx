import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }))

// 価格計算関数
function calculatePrice(originalPrice: number, discountRate: number): number {
  return Math.round(originalPrice * (1 - discountRate / 100))
}

// 価格計算API
app.post('/api/calculate', async (c) => {
  try {
    const { discountRate } = await c.req.json()
    
    if (!discountRate || discountRate < 0 || discountRate > 100) {
      return c.json({ error: '割引率は0〜100の範囲で入力してください' }, 400)
    }

    // 元の価格（税込）
    const regularOriginalPrice = 4400
    const hardOriginalPrice = 4950

    // 割引後の価格を計算
    const regularPrice = calculatePrice(regularOriginalPrice, discountRate)
    const hardPrice = calculatePrice(hardOriginalPrice, discountRate)

    return c.json({
      discountRate,
      prices: {
        regular: {
          original: regularOriginalPrice,
          discounted: regularPrice
        },
        hard: {
          original: hardOriginalPrice,
          discounted: hardPrice
        }
      }
    })
  } catch (error) {
    return c.json({ error: 'リクエストの処理中にエラーが発生しました' }, 500)
  }
})

// 画像生成API
app.post('/api/generate-image', async (c) => {
  try {
    const formData = await c.req.formData()
    const imageFile = formData.get('image') as File
    const discountRate = formData.get('discountRate') as string
    const campaignType = formData.get('campaignType') as string

    if (!imageFile || !discountRate) {
      return c.json({ error: '画像と割引率は必須です' }, 400)
    }

    // 画像をBase64に変換
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const imageUrl = `data:${imageFile.type};base64,${base64Image}`

    // 価格計算
    const regularPrice = calculatePrice(4400, Number(discountRate))
    const hardPrice = calculatePrice(4950, Number(discountRate))

    // キャンペーンタイトル設定
    const campaignTitle = campaignType === 'thanksgiving' ? '大感謝祭 限定キャンペーン' : 
                          campaignType === 'marathon' ? 'お買い物マラソン限定キャンペーン' :
                          '限定キャンペーン'

    // NanoBanana画像生成用のプロンプト
    const prompt = `This is a Japanese promotional campaign image for a scalp brush product. 
The image should maintain the exact same layout and design as the reference image.

Campaign title at the top: "${campaignTitle}"
Product name: "スカルプブラシ コム"

Discount section with red arrow label showing: "${discountRate}% OFF"

Product pricing:
- Regular model (コムレギュラー): Original price ¥4,400 (税込) → Special price ¥${regularPrice.toLocaleString('ja-JP')} (税込)
- Hard model (コムハード): Original price ¥4,950 (税込) → Special price ¥${hardPrice.toLocaleString('ja-JP')} (税込)

Keep all other elements exactly the same including:
- Product images (white and brown brushes)
- Layout and positioning
- Typography and fonts
- Color scheme
- Footer text: "※割引率は変更になる可能性がございます"

IMPORTANT: Only change the discount percentage and calculated prices. Do NOT change any other design elements.`

    // NanoBanana API呼び出し用のリクエストボディを返す
    return c.json({
      success: true,
      prompt,
      imageUrl,
      prices: {
        regular: regularPrice,
        hard: hardPrice
      },
      discountRate: Number(discountRate)
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return c.json({ error: '画像生成中にエラーが発生しました' }, 500)
  }
})

// ホームページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>画像編集システム - キャンペーン画像生成</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .preview-container {
            max-width: 100%;
            border: 2px dashed #cbd5e0;
            border-radius: 8px;
            padding: 20px;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .preview-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }
          .loading {
            display: none;
          }
          .loading.active {
            display: flex;
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8 max-w-6xl">
            <div class="bg-white rounded-2xl shadow-2xl p-8">
                <h1 class="text-4xl font-bold text-gray-800 mb-2 text-center">
                    <i class="fas fa-image mr-3 text-indigo-600"></i>
                    画像編集システム
                </h1>
                <p class="text-gray-600 text-center mb-8">キャンペーン画像の割引率と価格を簡単に変更</p>
                
                <!-- 入力セクション -->
                <div class="grid md:grid-cols-2 gap-6 mb-8">
                    <!-- 左側: 画像アップロード -->
                    <div class="space-y-4">
                        <h2 class="text-xl font-semibold text-gray-700 mb-4">
                            <i class="fas fa-upload mr-2 text-indigo-500"></i>
                            1. 元画像をアップロード
                        </h2>
                        
                        <div class="border-2 border-dashed border-indigo-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer" id="dropZone">
                            <input type="file" id="imageInput" accept="image/*" class="hidden">
                            <i class="fas fa-cloud-upload-alt text-5xl text-indigo-400 mb-3"></i>
                            <p class="text-gray-600">クリックまたはドラッグ&ドロップ</p>
                            <p class="text-sm text-gray-500 mt-2">PNG, JPG, JPEG対応</p>
                        </div>
                        
                        <div id="uploadedImagePreview" class="preview-container hidden">
                            <img id="uploadedImage" class="preview-image" alt="アップロード画像">
                        </div>
                    </div>
                    
                    <!-- 右側: 設定 -->
                    <div class="space-y-4">
                        <h2 class="text-xl font-semibold text-gray-700 mb-4">
                            <i class="fas fa-sliders-h mr-2 text-indigo-500"></i>
                            2. 設定を入力
                        </h2>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">キャンペーンタイプ</label>
                            <select id="campaignType" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="thanksgiving">大感謝祭 限定キャンペーン</option>
                                <option value="marathon">お買い物マラソン限定キャンペーン</option>
                                <option value="custom">カスタム</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">割引率 (%)</label>
                            <input type="number" id="discountRate" min="0" max="100" step="1" value="20" 
                                   class="w-full px-4 py-3 text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h3 class="font-semibold text-gray-700 mb-3">計算結果（税込価格）</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-600">コムレギュラー:</span>
                                    <div class="text-right">
                                        <span class="text-xs text-gray-400 line-through">¥4,400</span>
                                        <span class="text-lg font-bold text-red-600 ml-2" id="regularPrice">¥3,520</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-600">コムハード:</span>
                                    <div class="text-right">
                                        <span class="text-xs text-gray-400 line-through">¥4,950</span>
                                        <span class="text-lg font-bold text-red-600 ml-2" id="hardPrice">¥3,960</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <button id="generateBtn" disabled class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                            <i class="fas fa-magic mr-2"></i>
                            画像を生成
                        </button>
                    </div>
                </div>
                
                <!-- 生成結果セクション -->
                <div id="resultSection" class="hidden mt-8 pt-8 border-t border-gray-200">
                    <h2 class="text-xl font-semibold text-gray-700 mb-4">
                        <i class="fas fa-check-circle mr-2 text-green-500"></i>
                        3. 生成された画像
                    </h2>
                    
                    <div id="loadingIndicator" class="loading flex-col items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
                        <p class="text-gray-600">AI画像生成中...</p>
                        <p class="text-sm text-gray-500 mt-2">最大2分程度かかる場合があります</p>
                    </div>
                    
                    <div id="resultImageContainer" class="hidden">
                        <div class="preview-container">
                            <img id="resultImage" class="preview-image" alt="生成された画像">
                        </div>
                        
                        <div class="flex gap-4 mt-4">
                            <a id="downloadBtn" href="#" download="campaign_image.png" 
                               class="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-all text-center">
                                <i class="fas fa-download mr-2"></i>
                                画像をダウンロード
                            </a>
                            <button id="resetBtn" 
                                    class="flex-1 bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition-all">
                                <i class="fas fa-redo mr-2"></i>
                                最初からやり直す
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 使い方ガイド -->
            <div class="bg-white rounded-lg shadow-lg p-6 mt-6">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">
                    <i class="fas fa-info-circle mr-2 text-blue-500"></i>
                    使い方
                </h3>
                <ol class="list-decimal list-inside space-y-2 text-gray-600">
                    <li>キャンペーン画像（元画像）をアップロードします</li>
                    <li>キャンペーンタイプを選択し、割引率を入力します</li>
                    <li>「画像を生成」ボタンをクリックすると、AIが新しい画像を生成します</li>
                    <li>生成された画像をダウンロードして使用できます</li>
                </ol>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app
