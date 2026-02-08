/**
 * 座標設定UI - ドラッグ＆ドロップで編集領域を選択
 */

class CoordinateSelector {
    constructor(canvasId, previewId) {
        this.canvas = document.getElementById(canvasId);
        this.preview = document.getElementById(previewId);
        this.ctx = this.canvas.getContext('2d');
        this.image = null;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentRect = null;
        this.selectedAreas = {
            campaign: null,    // キャンペーン名
            discount: null,    // 割引率
            regularPrice: null, // レギュラー価格
            hardPrice: null    // ハード価格
        };
        this.currentArea = 'campaign';
        this.scale = 1;

        this.initEventListeners();
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    loadImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.image = img;
                
                // Canvasサイズを調整（最大800px幅）
                const maxWidth = 800;
                const scale = Math.min(1, maxWidth / img.width);
                this.scale = scale;
                
                this.canvas.width = img.width * scale;
                this.canvas.height = img.height * scale;
                
                this.redraw();
                resolve();
            };
            
            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    setCurrentArea(areaName) {
        this.currentArea = areaName;
        console.log('Current area:', areaName);
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.startX = (e.clientX - rect.left) / this.scale;
        this.startY = (e.clientY - rect.top) / this.scale;
        this.isDrawing = true;
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / this.scale;
        const currentY = (e.clientY - rect.top) / this.scale;

        this.currentRect = {
            x: Math.min(this.startX, currentX),
            y: Math.min(this.startY, currentY),
            width: Math.abs(currentX - this.startX),
            height: Math.abs(currentY - this.startY)
        };

        this.redraw();
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentRect && this.currentRect.width > 10 && this.currentRect.height > 10) {
            // 座標を保存
            this.selectedAreas[this.currentArea] = {
                x: Math.round(this.currentRect.x),
                y: Math.round(this.currentRect.y),
                width: Math.round(this.currentRect.width),
                height: Math.round(this.currentRect.height)
            };

            console.log(`Selected ${this.currentArea}:`, this.selectedAreas[this.currentArea]);
            
            // 次の領域に自動移動
            this.moveToNextArea();
            
            this.currentRect = null;
            this.redraw();
            this.updatePreview();
        }
    }

    moveToNextArea() {
        const areas = ['campaign', 'discount', 'regularPrice', 'hardPrice'];
        const currentIndex = areas.indexOf(this.currentArea);
        const nextIndex = (currentIndex + 1) % areas.length;
        this.currentArea = areas[nextIndex];
        
        // UIを更新
        document.querySelectorAll('.area-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-area="${this.currentArea}"]`)?.classList.add('active');
    }

    redraw() {
        if (!this.image) return;

        // 画像を描画
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(
            this.image, 
            0, 0, 
            this.canvas.width, 
            this.canvas.height
        );

        // 既存の選択領域を描画
        for (const [areaName, area] of Object.entries(this.selectedAreas)) {
            if (area) {
                this.drawRect(area, this.getAreaColor(areaName), areaName);
            }
        }

        // 現在の選択中の矩形を描画
        if (this.currentRect) {
            this.drawRect(this.currentRect, this.getAreaColor(this.currentArea), this.currentArea, true);
        }
    }

    drawRect(rect, color, label, isDragging = false) {
        const x = rect.x * this.scale;
        const y = rect.y * this.scale;
        const width = rect.width * this.scale;
        const height = rect.height * this.scale;

        // 矩形を描画
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = isDragging ? 3 : 2;
        this.ctx.strokeRect(x, y, width, height);

        // 半透明の背景
        this.ctx.fillStyle = color + '30';
        this.ctx.fillRect(x, y, width, height);

        // ラベルを描画
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(this.getAreaLabel(label), x + 5, y + 20);
    }

    getAreaColor(areaName) {
        const colors = {
            campaign: '#FF6B6B',    // 赤
            discount: '#4ECDC4',    // 青緑
            regularPrice: '#FFD93D', // 黄
            hardPrice: '#6BCB77'     // 緑
        };
        return colors[areaName] || '#999';
    }

    getAreaLabel(areaName) {
        const labels = {
            campaign: 'キャンペーン名',
            discount: '割引率',
            regularPrice: 'レギュラー価格',
            hardPrice: 'ハード価格'
        };
        return labels[areaName] || areaName;
    }

    updatePreview() {
        const previewHtml = Object.entries(this.selectedAreas)
            .filter(([_, area]) => area !== null)
            .map(([areaName, area]) => {
                return `
                    <div class="coordinate-item" style="border-left: 4px solid ${this.getAreaColor(areaName)}">
                        <strong>${this.getAreaLabel(areaName)}</strong>
                        <span class="coordinate-values">
                            x: ${area.x}, y: ${area.y}, 
                            width: ${area.width}, height: ${area.height}
                        </span>
                    </div>
                `;
            })
            .join('');

        this.preview.innerHTML = previewHtml || '<p class="text-gray-500">領域を選択してください</p>';
    }

    getCoordinates() {
        // 未設定の領域がある場合は警告
        const unset = Object.entries(this.selectedAreas)
            .filter(([_, area]) => area === null)
            .map(([name, _]) => this.getAreaLabel(name));

        if (unset.length > 0) {
            console.warn('未設定の領域:', unset.join(', '));
        }

        return {
            areas: this.selectedAreas,
            imageWidth: this.image.width,
            imageHeight: this.image.height
        };
    }

    loadTemplate(template) {
        this.selectedAreas = template.areas;
        this.redraw();
        this.updatePreview();
    }

    reset() {
        this.selectedAreas = {
            campaign: null,
            discount: null,
            regularPrice: null,
            hardPrice: null
        };
        this.currentArea = 'campaign';
        this.redraw();
        this.updatePreview();
    }
}

// グローバルに公開
window.CoordinateSelector = CoordinateSelector;
