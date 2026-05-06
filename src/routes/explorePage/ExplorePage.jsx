import './explorePage.css'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../lib/useI18n'

const ExplorePage = () => {
  const navigate = useNavigate()
  const { lang } = useI18n()

  const copy = useMemo(() => {
    if (lang === 'vi') {
      return {
        badge: 'Prompt Library',
        title: 'Khám phá ý tưởng chuyến đi',
        subtitle: 'Chọn một mẫu, chỉnh nhẹ nếu cần, rồi gửi thẳng vào khung chat để bắt đầu.',
        usePrompt: 'Dùng prompt này',
        startBlank: 'Chat trống',
      }
    }

    return {
      badge: 'Prompt Library',
      title: 'Explore Trip Ideas',
      subtitle: 'Pick a starter, tweak it if needed, and send it straight to your chat composer.',
      usePrompt: 'Use this prompt',
      startBlank: 'Blank chat',
    }
  }, [lang])

  const promptCards = useMemo(() => {
    if (lang === 'vi') {
      return [
        {
          icon: 'ti ti-map-pin',
          title: 'Food tour cuối tuần',
          description: 'Ăn ngon, đi nhẹ, phù hợp nhóm bạn 2-4 người.',
          tags: ['2 ngày 1 đêm', 'Trong thành phố', 'Chi phí vừa'],
          prompt:
            'Gợi ý lịch food tour 2 ngày 1 đêm ở Hà Nội cho 3 người, ưu tiên quán địa phương, có địa chỉ rõ và tổng chi phí dự kiến.',
        },
        {
          icon: 'ti ti-mountain',
          title: 'Thiên nhiên thư giãn',
          description: 'Lịch đi chậm, cảnh đẹp, ít di chuyển gấp.',
          tags: ['3 ngày', 'Chụp ảnh', 'Nghỉ dưỡng'],
          prompt:
            'Lên lịch trình 3 ngày thiên về thiên nhiên gần TP.HCM, có điểm ngắm cảnh đẹp, khách sạn yên tĩnh và chi phí tầm trung.',
        },
        {
          icon: 'ti ti-building-skyscraper',
          title: 'City break thông minh',
          description: 'Kết hợp điểm nổi bật, cafe, mua sắm và nightlife.',
          tags: ['2 ngày', 'Linh hoạt', 'Nhiều trải nghiệm'],
          prompt:
            'Lập kế hoạch city break 2 ngày ở Đà Nẵng gồm điểm tham quan chính, quán cafe đẹp, khu ăn tối và gợi ý thời gian tối ưu.',
        },
        {
          icon: 'ti ti-users-group',
          title: 'Trip gia đình',
          description: 'Ưu tiên an toàn, tiện di chuyển và hoạt động nhẹ.',
          tags: ['Gia đình', 'Trẻ em', 'Dễ đi'],
          prompt:
            'Tạo lịch trình du lịch gia đình 4 người (có 1 trẻ em) tại Nha Trang trong 3 ngày, ưu tiên chỗ dễ di chuyển và hoạt động nhẹ.',
        },
        {
          icon: 'ti ti-wallet',
          title: 'Budget low-cost',
          description: 'Tối ưu chi phí nhưng vẫn đủ trải nghiệm chính.',
          tags: ['Tiết kiệm', 'Sinh viên', 'Thực tế'],
          prompt:
            'Gợi ý chuyến đi tiết kiệm 2 ngày từ TP.HCM cho 2 người, ngân sách dưới 3 triệu, gồm đi lại, ăn uống và ngủ nghỉ.',
        },
        {
          icon: 'ti ti-camera',
          title: 'Điểm chụp ảnh đẹp',
          description: 'Tập trung spot đẹp, thời điểm chụp và tuyến hợp lý.',
          tags: ['Check-in', 'Golden hour', 'Tối ưu lộ trình'],
          prompt:
            'Gợi ý lịch trình 1 ngày ở Hà Nội tập trung các điểm chụp ảnh đẹp, có khung giờ chụp phù hợp và thứ tự di chuyển tối ưu.',
        },
      ]
    }

    return [
      {
        icon: 'ti ti-map-pin',
        title: 'Weekend Food Tour',
        description: 'Light schedule, great local food, ideal for 2-4 friends.',
        tags: ['2 days', 'City', 'Mid budget'],
        prompt:
          'Suggest a 2-day food tour in Hanoi for 3 people, focused on authentic local spots with clear addresses and an estimated total cost.',
      },
      {
        icon: 'ti ti-mountain',
        title: 'Nature Reset',
        description: 'Slow pace, scenic stops, less rushed movement.',
        tags: ['3 days', 'Scenic', 'Relax'],
        prompt:
          'Build a 3-day nature-focused trip near Ho Chi Minh City with scenic viewpoints, a quiet hotel, and a medium budget plan.',
      },
      {
        icon: 'ti ti-building-skyscraper',
        title: 'Smart City Break',
        description: 'Landmarks, cafes, shopping, and nightlife in balance.',
        tags: ['2 days', 'Flexible', 'Mixed activities'],
        prompt:
          'Create a 2-day city break in Da Nang with key attractions, nice cafes, dinner areas, and practical time allocation.',
      },
      {
        icon: 'ti ti-users-group',
        title: 'Family-Friendly Trip',
        description: 'Safe flow, easy transport, and lighter activities.',
        tags: ['Family', 'Kid-friendly', 'Comfort'],
        prompt:
          'Plan a 3-day family trip in Nha Trang for 4 people including one child, prioritizing easy transport and low-stress activities.',
      },
      {
        icon: 'ti ti-wallet',
        title: 'Low-Cost Plan',
        description: 'Keep cost low while covering the essentials.',
        tags: ['Budget', 'Student', 'Practical'],
        prompt:
          'Suggest a low-cost 2-day trip from Ho Chi Minh City for 2 people under 3,000,000 VND, including transport, food, and stay.',
      },
      {
        icon: 'ti ti-camera',
        title: 'Photo Spots Route',
        description: 'Focus on great shots with efficient routing.',
        tags: ['Check-in', 'Golden hour', 'Route optimized'],
        prompt:
          'Give me a one-day Hanoi photo-spot itinerary with ideal shooting times and an efficient stop order.',
      },
    ]
  }, [lang])

  const goWithPrompt = (prompt) => {
    const qs = new URLSearchParams({
      new: '1',
      prefill: prompt,
    })
    navigate(`/dashboard?${qs.toString()}`)
  }

  return (
    <div className="explorePage">
      <section className="exploreHero">
        <div className="exploreHeroBadge">{copy.badge}</div>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
        <button type="button" className="exploreHeroBtn" onClick={() => navigate('/dashboard?new=1')}>
          <i className="ti ti-message-plus" />
          {copy.startBlank}
        </button>
      </section>

      <section className="exploreGrid">
        {promptCards.map((card) => (
          <article className="exploreCard" key={card.title}>
            <div className="exploreCardHead">
              <div className="exploreCardIcon">
                <i className={card.icon} />
              </div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            </div>

            <div className="exploreCardTags">
              {card.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <div className="exploreCardPrompt">{card.prompt}</div>

            <button type="button" className="exploreCardBtn" onClick={() => goWithPrompt(card.prompt)}>
              <i className="ti ti-send-2" />
              {copy.usePrompt}
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

export default ExplorePage

