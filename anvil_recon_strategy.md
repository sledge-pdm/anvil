# anvil recon strategy

- 現在anvilはパッケージとしてもインスタンス（Anvil.ts）としても単一バッファ管理としてのみの機能を持っているが、
  sledge本体の機能分割を鑑みてこれを変更したい
- 具体的には旧anvilをBufferとして移管し、差分の概念はsledgeの履歴の概念と合わせてlapseに移行する（TileはWASMのRgbaBufferに移動すべきかもしれない）
- 新たに選択範囲関係の機能をplateに追加し、***Anvilをこれら4種をとりまとめるインターフェースとして作成したい***

/anvil
- buffer (<- anvil)
- grip (ツール)
- lapse (履歴、差分)
- plate (選択範囲)

## 注意点

- 各機能の依存性の確認（例えば、bufferの操作はlapseに登録するべきdiff差分を出力するのに対し、lapseのundo/redoは逆にbufferを操作する。Anvil側で統制ができればいいが、そのあたりは明確かつシンプルに済ませる）
- 未確定だが、4種の機能について明確な依存性を持たせず、インターフェースとしての入出力コマンドを共通で用意し、それをつなげることで実現したほうが今後の変化に強い構成にできるかもしれない（例えば、gripのツールが「ピクセルを変更する」動作を行う際は直接bufferの関数を呼び出すのではなくインターフェースのsetPixel関数を呼び、anvil側でインターフェースのsetPixelとbufferのsetPixelをつなげる(+ここで差分をlapseに登録するかの処理を入れればbuffer側のlapseの依存を減らせる)）

```ts
abstract class API {
    // opt = { emitToLapse?: boolean, ... }
    setPixel(x, y, color, opt);
}

// grip/pen
function move(mx, my, currentColor, ...) {
    //...
    api.setPixel(mx, my, currentColor, { emitToLapse: true });
}

// buffer
class Buffer {
    // ...
    public setPixel(x, y, color): Diff | undefined {
        // set pixel for actual buffer.

        // returns diff, but notice that this can be shared type (as already did in src/types/patch)
        // and most important point is that buffer doesn't care lapse at all. it's all up to anvil.
    }
}

/** lapse */

class Lapse {
    // ...
    // Diffは疑似的にピクセル差分として書いているが、実際はストローク中の蓄積の後のregisterであったり、
    // もしくは全くそれを使わないbbox+partial bufferでの登録もありうる点に注意
    registerDiff(diff: Diff) { ... }

    undo() {
        const undoDiff = ...; // get from stack or something
        undoDiff.pixels().forEach((pDiff) => {
            setPixel(pDiff.x, pDiff.y, pDiff.before, { emitToLapse: false });
        });
    }
}

/** anvil */
class Layer {
    buffer: Buffer,
    lapse: Lapse,
}

class AnvilAPI extends API {
    constructor(private layer: Layer, private globalPlate: Plate) { ... }

    setPixel(x, y, color, opt) {
        // connect into buffer
        if (opt.emitToLapse) {
            const diff = this.layer.buffer.setPixel(x, y, color);
            this.layer.lapse.registerDiff();
        } else {
            this.layer.buffer.setPixel(x, y, color); // just dispose
        }
    }

    // ...

    // e.g, called from grip/rectSelection etc
    addSelection(selectionFragment) {
        this.globalPlate.addSelection(selectionFragment);
    }
}
```