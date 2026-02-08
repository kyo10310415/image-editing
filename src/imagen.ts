import { PredictionServiceClient } from '@google-cloud/aiplatform';
import * as fs from 'fs';

// Vertex AI クライアントの初期化
const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

interface GenerateImageParams {
  prompt: string;
  imageUrl?: string;
  aspectRatio?: string;
}

export async function generateImageWithImagen(params: GenerateImageParams): Promise<string> {
  const { prompt, imageUrl, aspectRatio = '16:9' } = params;

  // 必須環境変数の確認
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT environment variable is not set');
  }

  // Render環境でのシークレットファイルパス処理
  // Renderでは /etc/secrets/ 配下にファイルが配置されるが、
  // ファイル名にスラッシュが使えないため、ファイル名のみを指定
  let credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  // もし GOOGLE_APPLICATION_CREDENTIALS が設定されていない場合、
  // デフォルトのファイル名を使用（Renderのシークレットファイル用）
  if (!credentials) {
    credentials = './gcp-key.json'; // ローカル開発用
  }
  
  // 環境変数から直接JSON文字列を読み込む方法もサポート
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    // Base64デコードしてJSONファイルを一時的に作成
    const keyContent = Buffer.from(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      'base64'
    ).toString('utf-8');
    
    // 一時ファイルとして保存
    const tmpPath = '/tmp/gcp-key.json';
    fs.writeFileSync(tmpPath, keyContent);
    credentials = tmpPath;
  }

  try {
    // クライアントの初期化
    const client = new PredictionServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });

    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001`;

    // リクエストパラメータの構築
    const instances: any[] = [
      {
        prompt: prompt,
      },
    ];

    // 参照画像がある場合は追加（編集モード）
    if (imageUrl) {
      // Data URLからBase64部分を抽出
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (base64Match) {
        instances[0].image = {
          bytesBase64Encoded: base64Match[1],
        };
      }
    }

    const parameters = {
      sampleCount: 1,
      aspectRatio: aspectRatio,
      language: 'ja',
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_adult',
    };

    const request: any = {
      endpoint,
      instances: instances,
      parameters: parameters,
    };

    console.log('Calling Vertex AI Imagen API...');
    const [response] = await client.predict(request);
    
    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];
      
      // レスポンスから画像データを取得
      let imageData: string | undefined;
      
      // structValue から取得を試みる
      if (prediction.structValue?.fields?.bytesBase64Encoded) {
        imageData = prediction.structValue.fields.bytesBase64Encoded.stringValue;
      }
      // 直接アクセスを試みる
      else if (prediction.bytesBase64Encoded) {
        imageData = prediction.bytesBase64Encoded;
      }
      
      if (imageData) {
        // 画像データをデータURLとして返す
        return `data:image/png;base64,${imageData}`;
      }
    }
    
    throw new Error('No image generated from Imagen API');
  } catch (error: any) {
    console.error('Imagen API error:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw new Error(`Imagen API failed: ${error.message || 'Unknown error'}`);
  }
}

// 画像URLからBase64データを取得
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error fetching image:', error);
    throw error;
  }
}
