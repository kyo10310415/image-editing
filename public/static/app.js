// DOMが完全に読み込まれてから実行
document.addEventListener('DOMContentLoaded', function() {
// グローバル変数
let uploadedImageFiles = [];
let imageInputType = 'file'; // 'file' or 'url'

// DOM要素
const imageInputTypeRadios = document.getElementsByName('imageInputType');
const fileUploadSection = document.getElementById('fileUploadSection');
const urlInputSection = document.getElementById('urlInputSection');
const imageUrlsTextarea = document.getElementById('imageUrls');
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const uploadedImagesContainer = document.getElementById('uploadedImagesContainer');
const uploadedImagesList = document.getElementById('uploadedImagesList');
const imageCount = document.getElementById('imageCount');
const clearImagesBtn = document.getElementById('clearImagesBtn');
const discountRateInput = document.getElementById('discountRate');
const campaignTypeSelect = document.getElementById('campaignType');
const customCampaignNameContainer = document.getElementById('customCampaignNameContainer');
const customCampaignNameInput = document.getElementById('customCampaignName');
const regularPriceSpan = document.getElementById('regularPrice');
const hardPriceSpan = document.getElementById('hardPrice');
const generateBtn = document.getElementById('generateBtn');
const resultSection = document.getElementById('resultSection');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingProgress = document.getElementById('loadingProgress');
const resultImagesContainer = document.getElementById('resultImagesContainer');
const resultImagesList = document.getElementById('resultImagesList');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resetBtn = document.getElementById('resetBtn');

// 画像入力タイプの切り替え
imageInputTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        imageInputType = e.target.value;
        if (imageInputType === 'file') {
            fileUploadSection.classList.remove('hidden');
            urlInputSection.classList.add('hidden');
        } else {
            fileUploadSection.classList.add('hidden');
            urlInputSection.classList.remove('hidden');
        }
        // 生成ボタンの状態を更新
        updateGenerateButtonState();
    });
});

// 生成ボタンの状態を更新
function updateGenerateButtonState() {
    if (imageInputType === 'file') {
        generateBtn.disabled = uploadedImageFiles.length === 0;
    } else {
        const urls = imageUrlsTextarea.value.trim();
        generateBtn.disabled = urls === '';
    }
}

// URL入力の変更を監視
imageUrlsTextarea.addEventListener('input', updateGenerateButtonState);

// キャンペーンタイプ変更時の処理
campaignTypeSelect.addEventListener('change', () => {
    if (campaignTypeSelect.value === 'custom') {
        customCampaignNameContainer.classList.remove('hidden');
    } else {
        customCampaignNameContainer.classList.add('hidden');
    }
});

// ドロップゾーンのクリックイベント
dropZone.addEventListener('click', () => {
    imageInput.click();
});

// ドラッグ&ドロップイベント
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    
    const files = Array.from(e.dataTransfer.files);
    await handleFileSelect(files);
});

// ファイル選択イベント
imageInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    await handleFileSelect(files);
});

// ファイル処理（画像リサイズ機能付き）
async function handleFileSelect(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    // 画像をリサイズして追加
    const resizedFiles = [];
    for (const file of imageFiles) {
        try {
            const resizedFile = await resizeImage(file, 1920); // 最大幅1920pxにリサイズ
            resizedFiles.push(resizedFile);
        } catch (error) {
            console.error('画像リサイズエラー:', error);
            // リサイズに失敗した場合は元のファイルを使用
            resizedFiles.push(file);
        }
    }
    
    uploadedImageFiles = [...uploadedImageFiles, ...resizedFiles];
    
    updateImagesList();
    generateBtn.disabled = false;
}

// 画像リサイズ関数
function resizeImage(file, maxWidth = 1280) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 画像が最大幅より大きい場合、またはファイルサイズが大きい場合にリサイズ
                const needsResize = width > maxWidth || file.size > 500 * 1024; // 500KB以上はリサイズ
                
                if (needsResize) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Canvasから圧縮されたBlobを取得
                // ファイルサイズに応じて品質を調整
                const quality = file.size > 1024 * 1024 ? 0.7 : 0.85;
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        // Blobをファイルオブジェクトに変換
                        const resizedFile = new File([blob], file.name, {
                            type: 'image/jpeg', // JPEGに統一して圧縮率を上げる
                            lastModified: Date.now()
                        });
                        
                        // ファイルサイズの情報をログ出力
                        const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
                        const resizedSizeMB = (resizedFile.size / 1024 / 1024).toFixed(2);
                        console.log(`画像リサイズ: ${file.name}`);
                        console.log(`  元のサイズ: ${originalSizeMB} MB`);
                        console.log(`  リサイズ後: ${resizedSizeMB} MB`);
                        console.log(`  元の解像度: ${img.width}x${img.height}`);
                        console.log(`  リサイズ後: ${width}x${height}`);
                        console.log(`  品質: ${quality * 100}%`);
                        
                        resolve(resizedFile);
                    } else {
                        reject(new Error('Canvas to Blob conversion failed'));
                    }
                }, 'image/jpeg', quality); // JPEGで圧縮
            };
            
            img.onerror = () => {
                reject(new Error('Image loading failed'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('File reading failed'));
        };
        
        reader.readAsDataURL(file);
    });
}

// 画像リストの更新
function updateImagesList() {
    uploadedImagesList.innerHTML = '';
    imageCount.textContent = uploadedImageFiles.length;
    
    if (uploadedImageFiles.length > 0) {
        uploadedImagesContainer.classList.remove('hidden');
        dropZone.classList.add('hidden');
        
        uploadedImageFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageItem = document.createElement('div');
                imageItem.className = 'relative group';
                imageItem.innerHTML = `
                    <img src="${e.target.result}" class="w-full h-32 object-cover rounded-lg border-2 border-gray-200">
                    <button class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onclick="removeImage(${index})">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                    <p class="text-xs text-gray-600 mt-1 truncate">${file.name}</p>
                `;
                uploadedImagesList.appendChild(imageItem);
            };
            reader.readAsDataURL(file);
        });
    } else {
        uploadedImagesContainer.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

// 画像の削除
window.removeImage = function(index) {
    uploadedImageFiles.splice(index, 1);
    updateImagesList();
    
    if (uploadedImageFiles.length === 0) {
        generateBtn.disabled = true;
    }
};

// すべてクリア
clearImagesBtn.addEventListener('click', () => {
    uploadedImageFiles = [];
    updateImagesList();
    generateBtn.disabled = true;
});

// 価格計算
async function calculatePrices() {
    const discountRate = parseFloat(discountRateInput.value);
    
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
        return;
    }
    
    try {
        const response = await axios.post('/api/calculate', {
            discountRate: discountRate
        });
        
        const data = response.data;
        regularPriceSpan.textContent = `¥${data.prices.regular.discounted.toLocaleString('ja-JP')}`;
        hardPriceSpan.textContent = `¥${data.prices.hard.discounted.toLocaleString('ja-JP')}`;
    } catch (error) {
        console.error('価格計算エラー:', error);
    }
}

// 割引率変更時の価格自動計算
discountRateInput.addEventListener('input', calculatePrices);

// 生成された画像データ
let generatedImages = [];

// 画像生成
generateBtn.addEventListener('click', async () => {
    const discountRate = parseFloat(discountRateInput.value);
    const campaignType = campaignTypeSelect.value;
    const customCampaignName = customCampaignNameInput.value;
    
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
        alert('割引率は0〜100の範囲で入力してください');
        return;
    }
    
    if (campaignType === 'custom' && !customCampaignName) {
        alert('カスタムキャンペーン名を入力してください');
        return;
    }
    
    // 画像入力タイプに応じて処理を分岐
    if (imageInputType === 'file') {
        if (uploadedImageFiles.length === 0) {
            alert('画像をアップロードしてください');
            return;
        }
        await generateFromFiles(discountRate, campaignType, customCampaignName);
    } else {
        const imageUrls = imageUrlsTextarea.value.trim().split('\n').filter(url => url.trim() !== '');
        if (imageUrls.length === 0) {
            alert('画像URLを入力してください');
            return;
        }
        await generateFromUrls(imageUrls, discountRate, campaignType, customCampaignName);
    }
});

// ファイルから画像生成
async function generateFromFiles(discountRate, campaignType, customCampaignName) {
    
    // UIの更新
    resultSection.classList.remove('hidden');
    loadingIndicator.classList.add('active');
    resultImagesContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generatedImages = [];
    
    try {
        // FormDataの作成
        const formData = new FormData();
        uploadedImageFiles.forEach((file, index) => {
            formData.append(`image_${index}`, file);
        });
        formData.append('discountRate', discountRate);
        formData.append('campaignType', campaignType);
        if (customCampaignName) {
            formData.append('customCampaignName', customCampaignName);
        }
        
        // バックエンドAPIを呼び出してプロンプトを取得
        const response = await axios.post('/api/generate-batch', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        const { images, count, prices, campaignTitle } = response.data;
        
        loadingProgress.textContent = `${count}枚の画像を生成中...`;
        
        // 各画像を順次生成
        for (let i = 0; i < images.length; i++) {
            loadingProgress.textContent = `画像 ${i + 1}/${count} を生成中...`;
            
            const { prompt, imageUrl, originalName } = images[i];
            
            // 座標データを準備
            const requestData = {
                imageUrl: imageUrl,
                discountRate: discountRate,
                campaignTitle: campaignTitle,
                regularPrice: prices.regular,
                hardPrice: prices.hard,
                index: i
            };
            
            // 座標が設定されている場合は追加
            if (window.currentCoordinates && window.currentCoordinates.areas) {
                requestData.coordinates = window.currentCoordinates.areas;
                console.log('📍 Using custom coordinates:', requestData.coordinates);
            } else {
                console.log('⚠️ No custom coordinates, using auto-detection');
            }
            
            // Canvas APIで画像編集（座標指定 or 自動検出）
            const imageGenResponse = await axios.post('/api/execute-generation', requestData);
            
            if (imageGenResponse.data && imageGenResponse.data.success) {
                // バックエンドのレスポンス形式: { success: true, generated_images: [{ url: "..." }] }
                const generatedUrl = imageGenResponse.data.generated_images?.[0]?.url;
                
                if (generatedUrl) {
                    generatedImages.push({
                        url: generatedUrl,
                        originalName: originalName,
                        index: i
                    });
                } else {
                    console.error('Generated URL is missing in response:', imageGenResponse.data);
                }
            }
        }
        
        // すべての画像生成が完了
        displayGeneratedImages();
        loadingIndicator.classList.remove('active');
        resultImagesContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error('画像生成エラー:', error);
        let errorMessage = '画像生成中にエラーが発生しました。';
        
        if (error.response) {
            // サーバーからのエラーレスポンス
            console.error('エラーレスポンス:', error.response.data);
            errorMessage += `\nステータス: ${error.response.status}`;
            if (error.response.data && error.response.data.error) {
                errorMessage += `\n詳細: ${error.response.data.error}`;
            }
        } else if (error.request) {
            // リクエストは送信されたがレスポンスがない
            console.error('レスポンスなし:', error.request);
            errorMessage += '\nサーバーからの応答がありません。';
        } else {
            // リクエスト設定中のエラー
            console.error('エラー:', error.message);
            errorMessage += `\n${error.message}`;
        }
        
        alert(errorMessage);
        loadingIndicator.classList.remove('active');
    } finally {
        generateBtn.disabled = false;
    }
}

// URLから画像生成
async function generateFromUrls(imageUrls, discountRate, campaignType, customCampaignName) {
    // UIの更新
    resultSection.classList.remove('hidden');
    loadingIndicator.classList.add('active');
    resultImagesContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generatedImages = [];
    
    try {
        // バックエンドAPIを呼び出してプロンプトを取得
        const response = await axios.post('/api/generate-batch-url', {
            imageUrls: imageUrls,
            discountRate: discountRate,
            campaignType: campaignType,
            customCampaignName: customCampaignName
        });
        
        const { images, count, prices, campaignTitle } = response.data;
        
        loadingProgress.textContent = `${count}枚の画像を生成中...`;
        
        // 各画像を順次生成
        for (let i = 0; i < images.length; i++) {
            loadingProgress.textContent = `画像 ${i + 1}/${count} を生成中...`;
            
            const { prompt, imageUrl, originalName } = images[i];
            
            // 座標データを準備
            const requestData = {
                imageUrl: imageUrl,
                discountRate: discountRate,
                campaignTitle: campaignTitle,
                regularPrice: prices.regular,
                hardPrice: prices.hard,
                index: i
            };
            
            // 座標が設定されている場合は追加
            if (window.currentCoordinates && window.currentCoordinates.areas) {
                requestData.coordinates = window.currentCoordinates.areas;
                console.log('📍 Using custom coordinates:', requestData.coordinates);
            } else {
                console.log('⚠️ No custom coordinates, using auto-detection');
            }
            
            // Canvas APIで画像編集（座標指定 or 自動検出）
            const imageGenResponse = await axios.post('/api/execute-generation', requestData);
            
            if (imageGenResponse.data && imageGenResponse.data.success) {
                // バックエンドのレスポンス形式: { success: true, generated_images: [{ url: "..." }] }
                const generatedUrl = imageGenResponse.data.generated_images?.[0]?.url;
                
                if (generatedUrl) {
                    generatedImages.push({
                        url: generatedUrl,
                        originalName: originalName,
                        index: i
                    });
                } else {
                    console.error('Generated URL is missing in response:', imageGenResponse.data);
                }
            }
        }
        
        // すべての画像生成が完了
        displayGeneratedImages();
        loadingIndicator.classList.remove('active');
        resultImagesContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error('画像生成エラー:', error);
        let errorMessage = '画像生成中にエラーが発生しました。';
        
        if (error.response) {
            console.error('エラーレスポンス:', error.response.data);
            errorMessage += `\nステータス: ${error.response.status}`;
            if (error.response.data && error.response.data.error) {
                errorMessage += `\n詳細: ${error.response.data.error}`;
            }
        } else if (error.request) {
            console.error('レスポンスなし:', error.request);
            errorMessage += '\nサーバーからの応答がありません。';
        } else {
            console.error('エラー:', error.message);
            errorMessage += `\n${error.message}`;
        }
        
        alert(errorMessage);
        loadingIndicator.classList.remove('active');
    } finally {
        generateBtn.disabled = false;
    }
}

// 生成画像の表示
function displayGeneratedImages() {
    resultImagesList.innerHTML = '';
    
    generatedImages.forEach((image, index) => {
        const imageCard = document.createElement('div');
        imageCard.className = 'bg-white rounded-lg shadow-md overflow-hidden';
        imageCard.innerHTML = `
            <div class="preview-container">
                <img src="${image.url}" class="preview-image" alt="生成された画像 ${index + 1}">
            </div>
            <div class="p-4">
                <p class="text-sm text-gray-600 mb-2 truncate">${image.originalName}</p>
                <a href="${image.url}" download="campaign_${index + 1}_${discountRateInput.value}percent_off.png" 
                   class="block w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-all text-center">
                    <i class="fas fa-download mr-2"></i>
                    ダウンロード
                </a>
            </div>
        `;
        resultImagesList.appendChild(imageCard);
    });
}

// すべてダウンロード
downloadAllBtn.addEventListener('click', () => {
    generatedImages.forEach((image, index) => {
        const link = document.createElement('a');
        link.href = image.url;
        link.download = `campaign_${index + 1}_${discountRateInput.value}percent_off.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

// リセット
resetBtn.addEventListener('click', () => {
    uploadedImageFiles = [];
    generatedImages = [];
    imageUrlsTextarea.value = '';
    updateImagesList();
    resultSection.classList.add('hidden');
    resultImagesContainer.classList.add('hidden');
    loadingIndicator.classList.remove('active');
    generateBtn.disabled = true;
    discountRateInput.value = 20;
    campaignTypeSelect.value = 'thanksgiving';
    customCampaignNameContainer.classList.add('hidden');
    customCampaignNameInput.value = '';
    // ファイルアップロードモードに戻す
    document.querySelector('input[name="imageInputType"][value="file"]').checked = true;
    fileUploadSection.classList.remove('hidden');
    urlInputSection.classList.add('hidden');
    imageInputType = 'file';
    calculatePrices();
});

// 初期価格計算
calculatePrices();

}); // DOMContentLoaded終了

// ======================================
// 座標設定モーダル関連
// ======================================

let currentCoordinates = null;

// 座標設定モーダルを開く
window.openCoordinateSetup = function() {
    // 画像が選択されているか確認
    if (imageInputType === 'file') {
        if (uploadedImageFiles.length === 0) {
            alert('先に画像をアップロードしてください');
            return;
        }
        // 最初の画像を使用
        const reader = new FileReader();
        reader.onload = (e) => {
            openModalWithImage(e.target.result);
        };
        reader.readAsDataURL(uploadedImageFiles[0]);
    } else {
        // URL入力モード
        const urls = imageUrlsInput.value.trim().split('\n').filter(url => url);
        if (urls.length === 0) {
            alert('先に画像URLを入力してください');
            return;
        }
        openModalWithImage(urls[0]);
    }
};

function openModalWithImage(imageUrl) {
    const modal = document.getElementById('coordinateModal');
    modal.style.display = 'flex';
    
    // CoordinateSelectorを初期化
    if (!window.coordinateSelector) {
        window.coordinateSelector = new CoordinateSelector('coordinateCanvas', 'coordinatePreview');
    }
    
    // 画像を読み込む
    window.coordinateSelector.loadImage(imageUrl).then(() => {
        console.log('✅ 画像を読み込みました');
    }).catch(error => {
        console.error('❌ 画像の読み込みに失敗:', error);
        alert('画像の読み込みに失敗しました');
        closeCoordinateModal();
    });
}

// 座標設定モーダルを閉じる
window.closeCoordinateModal = function() {
    const modal = document.getElementById('coordinateModal');
    modal.style.display = 'none';
};

// 領域を選択
window.selectArea = function(areaName) {
    if (!window.coordinateSelector) return;
    
    window.coordinateSelector.setCurrentArea(areaName);
    
    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.area-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-area="${areaName}"]`)?.classList.add('active');
};

// 座標をリセット
window.resetCoordinates = function() {
    if (!window.coordinateSelector) return;
    
    const confirmed = confirm('選択した座標をすべてリセットしますか？');
    if (confirmed) {
        window.coordinateSelector.reset();
    }
};

// 座標を適用して生成
window.applyCoordinates = function() {
    if (!window.coordinateSelector) {
        alert('座標が設定されていません');
        return;
    }
    
    const coordinates = window.coordinateSelector.getCoordinates();
    
    // 未設定の領域を確認
    const unsetAreas = Object.entries(coordinates.areas)
        .filter(([_, area]) => area === null)
        .map(([name, _]) => window.coordinateSelector.getAreaLabel(name));
    
    if (unsetAreas.length > 0) {
        const confirmed = confirm(`以下の領域が未設定です。このまま生成しますか？\n\n${unsetAreas.join('\n')}`);
        if (!confirmed) return;
    }
    
    // 座標を保存
    currentCoordinates = coordinates;
    console.log('✅ 座標を保存しました:', currentCoordinates);
    
    // モーダルを閉じる
    closeCoordinateModal();
    
    alert('✅ 座標を設定しました。「画像を生成」ボタンをクリックして生成を開始してください。');
};

