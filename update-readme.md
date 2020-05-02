# hidden.inをEC2で起動するまでのメモ

最終更新日：2020-5-2
書いた人：dogrunjp

## hidden.inとは

- ビデオチャット・スクリーン共有ソフト 。"WebRTC signaling server."
- Lisence: Apache 2.0
- Node.js (Express)
- クライアント： Chromeだけ想定されているらしい



## 開発した人のQiita・レポジトリ

- [Qiitaの記事：オープンソースのビデオチャット・スクリーン共有ソフトhidden.inのご紹介...](https://qiita.com/ukiuni@github/items/a1372fac50a4ece1d5e8)
- [github: ukiuni/hidden.in](https://github.com/ukiuni/hidden.in)



## サーバの環境設定（基本的な操作含む）

### 自分のインストールした環境は...

- EC2 Ubuntu18.04 LTS
- t2.micro
- dockerはインストール済み
- 3000番だけポート開けておく

### node.jsインストール

```
$ sudo apt install -y nodejs npm
```

### hidden.inをgitclone

```
$ git clone https://github.com/ukiuni/hidden.in.git
$ cd hidden.in
```

### 少し修正

[ChromeのAPI仕様変更でそのままでは映像が流れない](https://one-it-thing.com/6066/)とのことで


static/js/index.js の以下の二箇所を変更
```
// remoteVideo.src = URL.createObjectURL(event.stream);
remoteVideo.srcObject = event.stream;

// localVideo.src = URL.createObjectURL(stream);
localVideo.srcObject = stream;
```
### 起動

```
$ npm start
```

### dockerで起動する場合

```
$ sudo docker run -p 3000:3000 ukiuni/hidden.in
```

ただしdockerの場合上記の修正が効かない？？
Dockerfileを見たけどよくわかりませんでした。



## https対応

hidden.inは以下の４つの環境変数を設定して使えるようで、
sslに対応するため、オレオレ認証局の証明書と秘密鍵を作る
```
${PORT} listening port
${CERT} ssl certification
${KEY} ssl private key
${HTTP} If you specify true, application boot with http.
```

証明書の作成は
ほぼこちらのQiitaの記事[Chrome58以降でハネられないSHA-2でオレオレ認証局...](https://qiita.com/mkgask/items/8d66dcada58a485e3585)
通りの手順を行なっています。


### openssl.cnfを編集

```
[ CA_default ]
dir = /etc/ssl/hoge 
certificate = $dir/ca.crt # 次項で作成
private_key = $dir/ca.key # 次項で作成
x509_extensions = usr_cert # 初期設定ママ

[ usr_cert ]
subjectAltName = @alt_names

[ req ]
req_extensions = v3_req

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = ssl.test
DNS.2 = *.ssl.test # localhostはサブドメイン使えないので注意
```

### オレオレ認証局の作成


1.  生成するアセットのディレクトリを作っておく

```
cd /etc/ssl
mkdir hoge
cd hoge
mkdir newcerts
mkdir certs
mkdir crl
mkdir private
chmod 700 private
```

2. オレオレ証明局の秘密鍵と証明書ファイルを作成

```
$ sudo openssl req -new -x509 -sha256 -days 36500 -newkey rsa:4096 -out ca.crt -keyout private/ca.key
```

3. 秘密鍵のパスフレーズ解除

```
$ sudo openssl rsa -in private/ca.key -out private/ca.key
```

4. サーバ証明書の秘密鍵と署名要求ファイルを作成

```
$ suudo openssl req -new -sha256 -days 36500 -newkey rsa:4096 -out server.csr -keyout private/server.key
```

5. 秘密鍵のパスフレーズ解除

```
$ openssl rsa -in private/server.key -out private/server.key
```

6. オレオレ認証局署名済みのサーバ証明書発行

```
$ sudo openssl ca -days 36500 -keyfile private/ca.key -cert ca.crt -in server.csr -out server.crt
```

### 環境変数の設定

process.env.KEY, process.env.CERTに秘密鍵と証明書のパスを記述します

1. 上記二つの環境変数が未設定であることを確認
```
$ node
> process.env
```

2. 環境変数を設定
```
> process.env.KEY = '/etc/ssl/hoge/private/server.key'
'/etc/ssl/hoge/private/server.key'

> process.env.CERT = '/etc/ssl/hoge/server.crt'
'/etc/ssl/hoge/server.crt'
```

### Amazon Certificate Manager(ACM)で証明書を発行し、インスタンスをロードバランサーに登録

略



## クライアント側の操作

- Chromeで
- チャットルームを開く人：https://hoge:3000を開いて、部屋の名前を入力
- その他の参加者：https://hoge:3000/部屋の名前　を入力する



## ログ出力について

expressにmorganというログのライブラリがあるようので、入れてみる。

1. morganをインストール
```
$ npm install morgan --save
```
2. index.jsに数行追加する
```
var express = require('express'),
  fs = require('fs'),
  path = require('path');

// この行を追加
var logger = require('morgan')

〜
var server
// 下二行追加
var logger = require('morgan')
app.use(logger("short"));
```

3. 上の記述だとコンソールにログが流されるだけなので、ファイルに保存するように少し変更

```
var logger = require('morgan')
app.use(logger("common",{
  stream: fs.createWriteStream('./log/access.log', {flags: 'a'})
}));
```

[Qiita: Express4のログ出力(morgan)について](https://qiita.com/mt_middle/items/543f83393c357ad3ab12)



## screenshare

リポジトリに含まれる"screen_chrome_extension.crx"をChromeの拡張機能にDrag&Dropすると"パッケージが無効です：CRX_HEADER_INVALID"とのことだった。

現在のChromeがcrxファイルからインストールする機能拡張を無効にしていることが、screen share extensionをインストールできない原因と思われる。

ちょっと面倒だけど以下の手順で、画面共有機能を使うことができるようになる

1. crxをunzip

```
$ unzip screenshare_chrome_extension.crx -d screenshare
```

2. Chromeに"chrome://extensions/"と入力し、デベロッパーモードをONにして、"パッケージ化されていない拡張機能を読み込む"をクリック、展開した先のscreenshare/ディレクトリを指定すると、extensionが読み込まれる。

3. 共有ボタン（ディスプレイのアイコン）で画面共有が開始されます。




## 課題

- portは環境変数で変更できるので、80番でいける？
- Dockerで利用したいけど、remoteVideo.srcの修正、Dockerの場合どのjsを修正すると良いのだろう？？
- 管理者機能的な機能は実装したい（利用できる部屋の指定とか）
- 映像・音声が複数人での利用に耐える品質であるのなら、諸々作り込んでみたい気はする。
- 複数人数・長時間利用した場合帯域（課金）がどの程度になるのか？どうやって調べる？