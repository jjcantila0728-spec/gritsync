export default function (req: any, res: any) {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end('{"ok":true,"probe":"v2"}')
}
