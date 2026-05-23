# 开放平台 - Webhook 开发指南

> 来源: https://hc.jiandaoyun.com/zh_cn/open/11507

## 推送方式

简道云仅支持 **POST** 请求。

**Header：**
- `Content-type`: `application/json`
- `X-JDY-DeliverId`: 推送事件 ID（唯一标识，用于去重）
- `X-JDY-Signature`: 签名内容

**Body 字段：**
- `op`: 推送事件（如 `data_create`）
- `data`: 具体数据内容

## 签名验证

1. 生成或指定一个 `secret` 并保存
2. 组合校验字符串: `"{nonce}:{payload}:{secret}:{timestamp}"`（冒号分隔）
3. 计算该字符串的 **SHA-1** 散列值
4. 与请求头 `X-JDY-Signature` 比对

**Python 示例：**

```python
def get_signature(nonce, payload, secret, timestamp):
    content = ':'.join([nonce, payload, secret, timestamp]).encode('utf-8')
    m = hashlib.sha1()
    m.update(content)
    return m.hexdigest()
```

## 响应规则

1. 目标服务器需在 **2 秒内** 返回 **2xx** 状态码
2. 单次推送最多重试 **5 次**
3. 连续失败达到 **100 次** 时，推送功能被自动关闭

## 代码示例

| 语言 | GitHub |
|------|--------|
| C# | github.com/jiandaoyun/webhook-demo |
| Go | github.com/jiandaoyun/webhook-demo |
| Java | github.com/jiandaoyun/webhook-demo |
| Node | github.com/jiandaoyun/webhook-demo |
| PHP | github.com/jiandaoyun/webhook-demo |
| Python | github.com/jiandaoyun/webhook-demo |
| Ruby | github.com/jiandaoyun/webhook-demo |
