try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Open("c:\Users\Keystone-Tech\Desktop\Домофондар\РЕКВИЗИТЫ ООО ДомофонДар.doc")
    $text = $doc.Content.Text
    $doc.Close()
    $word.Quit()
    Write-Output "=== TEXT START ==="
    Write-Output $text
    Write-Output "=== TEXT END ==="
} catch {
    Write-Error $_.Exception.Message
}
