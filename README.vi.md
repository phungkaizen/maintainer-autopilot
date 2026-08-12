# Maintainer Autopilot

## Ít tiền nhưng vẫn muốn code bằng AI liên tục thì làm sao?

Nhiều solo developer chỉ đủ tiền cho một hoặc hai gói AI, chứ không thể mua mọi gói Pro/Max và nhiều API trả phí cùng lúc. Maintainer Autopilot giúp bạn dùng quyền truy cập AI đang có, nhưng giữ quy trình làm việc và trạng thái dự án ở ngoài một phiên AI cụ thể.

Nói đơn giản: AI có thể viết code; công cụ này ghi nhớ việc đang làm, kiểm tra trước khi đưa thay đổi đi tiếp, và giúp bạn quay lại đúng chỗ khi có lỗi.

Tầm nhìn là: **Bạn đổi AI, không đổi công việc đang làm.**

> Public beta v0.1: hãy thử trước trên repository nhỏ, không quan trọng. Luôn xem lại thay đổi trước khi merge.

## Bạn cần chuẩn bị gì?

- Node.js 22
- Git
- Một CLI agent code chạy trên máy. Hiện tại Codex CLI là mặc định; bạn có thể cấu hình thủ công CLI agent khác.

Nếu muốn dùng tính năng tạo PR GitHub, bạn cũng cần GitHub CLI (`gh`) đã đăng nhập.

## Cài đặt

```bash
npm install -g maintainer-autopilot
maintainer-autopilot --help
```

## Chạy việc nhỏ đầu tiên

Hãy dùng một repository Git nhỏ và sạch. Có thể clone repo của bạn hoặc vào repo sẵn có:

```bash
git clone <dia-chi-repository-cua-ban> demo-repository
cd demo-repository
git switch main
maintainer-autopilot init
```

Lệnh `init` tạo file cấu hình tại `.maintainer-autopilot/config.json` và bỏ qua trạng thái chạy cục bộ khỏi Git.

Sau đó giao một việc nhỏ, dễ xem lại. Ví dụ chỉ sửa tài liệu:

```bash
maintainer-autopilot run \
  --task docs-quickstart \
  --prompt "Improve the README wording only. Do not change runtime behavior."
```

Xem trạng thái:

```bash
maintainer-autopilot status
```

Khi `run`, công cụ tạo nhánh `autopilot/docs-quickstart`. Agent được cấu hình sẽ làm thay đổi; sau đó công cụ chạy phần review và các kiểm tra đã cấu hình, ví dụ `npm test`. Kết quả sẽ ở một trong các trạng thái như `READY_TO_PROMOTE` (đã sẵn sàng để đưa lên) hoặc `REPAIR_REQUIRED` (cần sửa).

Đừng bắt đầu một việc mới khi việc cũ chưa xong. Mỗi workspace chỉ có một người viết AI đang hoạt động để tránh hai agent cùng sửa một chỗ.

## Khi cần sửa lại

Nếu review hoặc kiểm tra thất bại, hãy sửa tiếp trong cùng việc đó:

```bash
maintainer-autopilot repair \
  --prompt "Fix only the failing test/typecheck finding. Preserve the existing candidate behavior."
```

`repair` giữ nguyên dòng công việc và nhánh đã có, thay vì tạo một việc hoặc PR khác.

## Đưa lên GitHub (không bắt buộc)

Khi trạng thái là `READY_TO_PROMOTE`, bạn có thể tự xem nhánh và dừng ở đó. Nếu đã bật GitHub trong `.maintainer-autopilot/config.json` và có `gh`, tạo hoặc cập nhật PR bằng:

```bash
maintainer-autopilot promote --title "docs: improve quickstart"
```

Lệnh này commit thay đổi đã qua kiểm tra, lưu dấu nhận diện của các file, đẩy nhánh và tạo PR. Tự động merge vẫn tắt mặc định. Sau khi bạn merge PR thủ công, xác nhận để khép lại việc:

```bash
maintainer-autopilot checkpoint
```

## Các lệnh thường dùng

| Lệnh | Dùng khi nào |
| --- | --- |
| `maintainer-autopilot init` | Tạo cấu hình cho repository hiện tại. |
| `maintainer-autopilot run --task <id> --prompt "..."` | Bắt đầu một việc mới. |
| `maintainer-autopilot status` | Xem việc và lock hiện tại. |
| `maintainer-autopilot repair --prompt "..."` | Sửa tiếp việc đang lỗi. |
| `maintainer-autopilot promote --title "..."` | Đưa ứng viên đã qua kiểm tra lên GitHub. |
| `maintainer-autopilot checkpoint` | Xác nhận PR đã merge và kết thúc việc. |
| `maintainer-autopilot unlock --force` | Chỉ xóa lock cũ sau khi đã kiểm tra kỹ. |

### Cảnh báo về `unlock --force`

Chỉ dùng lệnh này **sau khi bạn đã chắc chắn tiến trình writer trước đó không còn chạy**. Nếu agent cũ vẫn đang ghi file mà bạn xóa lock, hai tiến trình có thể sửa cùng workspace và làm trạng thái dự án rối. Trước tiên hãy chạy `maintainer-autopilot status --json`, kiểm tra tiến trình và thay đổi Git.

```bash
maintainer-autopilot unlock --force
```

## Dùng CLI agent khác

Codex CLI là agent mặc định hôm nay. Nếu bạn có CLI agent cục bộ khác, mở `.maintainer-autopilot/config.json` sau khi chạy `init`, rồi đổi `agent.command` và `agent.args` theo cách gọi CLI đó. Agent cần nhận được nội dung công việc ở vị trí `"{prompt}"` trong `args`.

Bạn cũng nên cấu hình phần `review` và các `gates` cho phù hợp với repository. Hãy thử trên repo nhỏ trước; lệnh agent và lệnh kiểm tra trong file cấu hình đều có thể tác động đến máy và dự án của bạn.

## Hiện có trong v0.1

- Ghi nhớ trạng thái của việc đang làm.
- Không cho hai AI writer cùng thay đổi một workspace.
- Giữ việc sửa lỗi trong cùng một task.
- Chạy các kiểm tra đã cấu hình trước khi `promote`.
- Có thể quản lý luồng GitHub PR/CI nếu bạn bật cấu hình.
- Dùng Codex CLI mặc định, hoặc cấu hình thủ công một local CLI agent khác.

## Chưa có trong v0.1

- Tự nhận biết quota/hạn mức còn lại.
- Tự chuyển từ Codex sang OpenCode hoặc agent khác.
- Chọn agent dựa trên gói thuê bao bạn đang có.
- Tự chuyển sang lựa chọn miễn phí hoặc chạy cục bộ.

Vì vậy, công cụ không né quota, không hứa nhà cung cấp miễn phí, và chưa tích hợp hay đọc gói thuê bao của bạn.

## Public beta v0.1

Hãy bắt đầu với repository nhỏ, không chứa dữ liệu quan trọng, bí mật hay việc gấp. Công cụ hiện chạy trong Git worktree đang dùng, không phải một bản sao cách ly. Dùng branch, đọc `git diff`, và kiểm tra kỹ trước khi merge.

Nếu cài đặt thất bại, hướng dẫn khó hiểu, hoặc bạn gặp lỗi thật, hãy mở GitHub Issue để báo lại.

## Sắp tới

Hướng phát triển là hỗ trợ bạn tiếp tục cùng một công việc khi đổi công cụ, ví dụ chuyển Codex → OpenCode/agent khác, và khai thác hợp lý các gói thuê bao hoặc lựa chọn miễn phí/chạy cục bộ mà bạn đã có. Đây chỉ là roadmap, chưa có trong v0.1.

Xem thêm tài liệu tiếng Anh trong [README.md](README.md).
