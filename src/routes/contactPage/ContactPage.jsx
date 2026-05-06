import './contactPage.css'
import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/useI18n'
import { useNotify } from '../../components/notifications/useNotify'

const initialForm = {
  name: '',
  email: '',
  topic: 'feedback',
  message: '',
}

const ContactPage = () => {
  const { lang } = useI18n()
  const notify = useNotify()
  const [form, setForm] = useState(initialForm)
  const [submittedAt, setSubmittedAt] = useState(null)

  const copy = useMemo(() => {
    if (lang === 'vi') {
      return {
        badge: 'Hỗ trợ',
        title: 'Liên hệ đội ngũ TrAvel',
        subtitle: 'Gửi góp ý, báo lỗi, hoặc đề xuất tính năng mới cho trải nghiệm du lịch tốt hơn.',
        faqTitle: 'Câu hỏi thường gặp',
        formTitle: 'Gửi yêu cầu',
        formHint: 'Thông tin của bạn giúp team phản hồi đúng và nhanh hơn.',
        fields: {
          name: 'Họ và tên',
          email: 'Email',
          topic: 'Chủ đề',
          message: 'Nội dung',
        },
        topics: {
          feedback: 'Góp ý trải nghiệm',
          bug: 'Báo lỗi',
          data: 'Đề xuất dữ liệu',
          feature: 'Đề xuất tính năng',
        },
        placeholders: {
          name: 'Nhập họ tên',
          email: 'you@example.com',
          message: 'Mô tả chi tiết nhu cầu hoặc vấn đề bạn gặp...',
        },
        submit: 'Gửi yêu cầu',
        submitted: 'Đã gửi lúc',
        submitSuccess: 'Đã nhận yêu cầu của bạn. Cảm ơn bạn đã góp ý.',
        faqItems: [
          {
            q: 'Mất bao lâu để nhận phản hồi?',
            a: 'Thông thường trong vòng 24-48 giờ làm việc.',
          },
          {
            q: 'Có thể gửi đề xuất tính năng cho dashboard/admin không?',
            a: 'Có. Bạn chỉ cần chọn chủ đề "Đề xuất tính năng" và mô tả rõ tình huống sử dụng.',
          },
          {
            q: 'Khi báo lỗi cần kèm thông tin gì?',
            a: 'Nên kèm ảnh chụp màn hình, bước tái hiện và thời điểm xảy ra để team kiểm tra nhanh hơn.',
          },
        ],
      }
    }

    return {
      badge: 'Support',
      title: 'Contact the TrAvel Team',
      subtitle: 'Share feedback, report issues, or propose new features for a better planning experience.',
      faqTitle: 'Frequently asked questions',
      formTitle: 'Send a request',
      formHint: 'A clear request helps us respond faster and more accurately.',
      fields: {
        name: 'Full name',
        email: 'Email',
        topic: 'Topic',
        message: 'Message',
      },
      topics: {
        feedback: 'Experience feedback',
        bug: 'Bug report',
        data: 'Data suggestion',
        feature: 'Feature request',
      },
      placeholders: {
        name: 'Enter your full name',
        email: 'you@example.com',
        message: 'Describe your need or issue in detail...',
      },
      submit: 'Send request',
      submitted: 'Submitted at',
      submitSuccess: 'Your request has been received. Thank you for helping us improve.',
      faqItems: [
        {
          q: 'How long does a response usually take?',
          a: 'Most requests are reviewed within 24-48 business hours.',
        },
        {
          q: 'Can I request new dashboard/admin features?',
          a: 'Yes. Choose "Feature request" and describe the use case you want to support.',
        },
        {
          q: 'What should I include in a bug report?',
          a: 'Please add screenshots, reproduction steps, and approximate time of the issue.',
        },
      ],
    }
  }, [lang])

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return
    setSubmittedAt(Date.now())
    notify.success(copy.submitSuccess)
    setForm((prev) => ({ ...prev, message: '' }))
  }

  return (
    <div className="contactPage">
      <section className="contactHero">
        <div className="contactHeroBadge">{copy.badge}</div>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </section>

      <section className="contactGrid">
        <div className="contactFaq">
          <h2>{copy.faqTitle}</h2>
          <div className="contactFaqList">
            {copy.faqItems.map((item) => (
              <details key={item.q} className="contactFaqItem">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <form className="contactForm" onSubmit={onSubmit}>
          <div className="contactFormTop">
            <h2>{copy.formTitle}</h2>
            <p>{copy.formHint}</p>
          </div>

          <label className="contactField">
            <span>{copy.fields.name}</span>
            <input
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder={copy.placeholders.name}
              required
            />
          </label>

          <label className="contactField">
            <span>{copy.fields.email}</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder={copy.placeholders.email}
              required
            />
          </label>

          <label className="contactField">
            <span>{copy.fields.topic}</span>
            <select value={form.topic} onChange={(e) => onChange('topic', e.target.value)}>
              <option value="feedback">{copy.topics.feedback}</option>
              <option value="bug">{copy.topics.bug}</option>
              <option value="data">{copy.topics.data}</option>
              <option value="feature">{copy.topics.feature}</option>
            </select>
          </label>

          <label className="contactField">
            <span>{copy.fields.message}</span>
            <textarea
              rows={6}
              value={form.message}
              onChange={(e) => onChange('message', e.target.value)}
              placeholder={copy.placeholders.message}
              required
            />
          </label>

          <div className="contactFormActions">
            <button type="submit" className="contactSubmitBtn">
              <i className="ti ti-send-2" />
              {copy.submit}
            </button>
            {submittedAt ? (
              <div className="contactSubmitted">
                {copy.submitted}: {new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(submittedAt)}
              </div>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}

export default ContactPage

