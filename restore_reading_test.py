#!/usr/bin/env python3
"""
Скрипт для восстановления Reading Test ID=13
"""

import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ielts_platform.settings')
django.setup()

from core.models import ReadingTest, ReadingPart, ReadingQuestion, ReadingAnswerOption

def restore_reading_test():
    print("🔄 Восстанавливаем Reading Test ID=13...")
    
    # Получаем тест
    try:
        test = ReadingTest.objects.get(id=13)
        print(f"✅ Тест найден: {test.title}")
    except ReadingTest.DoesNotExist:
        print("❌ Тест не найден!")
        return
    
    # Удаляем существующие части (если есть)
    test.parts.all().delete()
    print("🗑️ Удалены старые части")
    
    # PART 1 - Georgia O'Keeffe
    print("📝 Создаем Part 1...")
    part1 = ReadingPart.objects.create(
        test=test,
        part_number=1,
        title="Part 1",
        instructions="",
        passage_text="""For seven decades, Georgia O'Keeffe (1887-1986) was a major figure in American art. Remarkably, she remained independent from shifting art trends and her work stayed true to her own vision, which was based on finding the essential, abstract forms in nature. With exceptionally keen powers of observation and great finesse with a paintbrush, she recorded subtle nuances of colour, shape, and light that enlivened her paintings and attracted a wide audience.

Born in 1887 near Sun Prairie, Wisconsin to cattle breeders Francis and Ida O'Keeffe, Georgia was raised on their farm along with her six siblings. By the time she graduated from high school in 1905, she had determined to make her way as an artist. She studied the techniques of traditional painting at the Art Institute of Chicago school (1905) and the Art Students League of New York (1907-8). After attending university and then training college, she became an art teacher and taught in elementary schools, high schools, and colleges in Virginia, Texas, and South Carolina from 1911 to 1918.

During this period, O'Keeffe began to experiment with creating abstract compositions in charcoal, and produced a series of innovative drawings that led her art in a new direction. She sent some of these drawings to a friend in New York, who showed them to art collector and photographer Alfred Stieglitz in January 1916. Stieglitz was impressed, and exhibited the drawings later that year at his gallery on Fifth Avenue, New York City, where the works of many avant-garde artists and photographers were introduced to the American public.

With Stieglitz's encouragement and promise of financial support, O'Keeffe arrived in New York in June 1918 to begin a career as an artist. For the next three decades, Stieglitz vigorously promoted her work in twenty-two solo exhibitions and numerous group installations. The two were married in 1924. The ups and downs of their personal and professional relationship were recorded in Stieglitz's celebrated black-and-white portraits of O'Keeffe, taken over the course of twenty years (1917-37).

By the mid-1920s, O'Keeffe was recognized as one of America's most important and successful artists, widely known for the architectural pictures that dramatically depict the soaring skyscrapers of New York. But most often, she painted botanical subjects, inspired by annual trips to the Stieglitz family summer home. In her magnified images depicting flowers, begun in 1924, O'Keeffe brings the viewer right into the picture.

Enlarging the tiniest details to fill an entire metre-wide canvas emphasized their shapes and lines and made them appear abstract. Such daring compositions helped establish O'Keeffe's reputation as an innovative modernist.

In 1929, O'Keeffe made her first extended trip to the state of New Mexico. It was a visit that had a lasting impact on her life, and an immediate effect on her work. Over the next two decades she made almost annual trips to New Mexico, staying up to six months there, painting in relative solitude, then returning to New York each winter to exhibit the new work at Stieglitz's gallery. This pattern continued until she moved permanently to New Mexico in 1949.

There, O'Keeffe found new inspiration: at first, it was the numerous sun-bleached bones she came across in the state's rugged terrain that sparked her imagination. Two of her earliest and most celebrated Southwestern paintings exquisitely reproduce a cow skull's weathered surfaces, jagged edges, and irregular openings. Later, she also explored another variation on this theme in her large series of Pelvis pictures, which focused on the contrasts between convex and concave surfaces, and solid and open spaces. However, it was the region's spectacular landscape, with its unusual geological formations, vivid colours, clarity of light, and exotic vegetation, that held the artist's imagination for more than four decades. Often, she painted the rocks, cliffs, and mountains in striking close-up, just as she had done with her botanical subjects.

O'Keeffe eventually owned two homes in New Mexico – the first, her summer retreat at Ghost Ranch, was nestled beneath 200-metre cliffs, while the second, used as her winter residence, was in the small town of Abiquiú. While both locales provided a wealth of imagery for her paintings, one feature of the Abiquiú house – the large walled patio with its black door – was particularly inspirational. In more than thirty pictures between 1946 and 1960, she reinvented the patio into an abstract arrangement of geometric shapes.

From the 1950s into the 1970s, O'Keeffe travelled widely, making trips to Asia, the Middle East, and Europe. Flying in planes inspired her last two major series – aerial views of rivers and expansive paintings of the sky viewed from just above clouds. In both series, O'Keeffe increased the size of her canvases, sometimes to mural proportions, reflecting perhaps her newly expanded view of the world. When in 1965 she successfully translated one of her cloud motifs to a monumental canvas measuring 6 metres in length (with the help of assistants), it was an enormous challenge and a special feat for an artist nearing eighty years of age.

The last two decades of the artist's life were relatively unproductive as ill health and blindness hindered her ability to work. O'Keeffe died in 1986 at the age of ninety-eight, but her rich legacy of some 900 paintings has continued to attract subsequent generations of artists and art lovers who derive inspiration from these very American images.""",
        passage_heading="Georgia O'Keeffe",
        passage_image_url=None,
        order=1
    )
    
    # Question 1 - Gap Fill
    q1 = ReadingQuestion.objects.create(
        part=part1,
        order=1,
        question_type="gap_fill",
        header="Questions 1–7",
        instruction="Complete the notes below.\nChoose ONE WORD ONLY from the passage for each answer.\nWrite your answers in boxes 1–7 on your answer sheet.",
        image_url=None,
        question_text="""The life and work of Georgia O'Keeffe

• studied art, then worked as a [[1]] in various places in the USA
• created drawings using [[2]] which were exhibited in New York City
• moved to New York and became famous for her paintings of the city's [[3]]
• produced a series of innovative close-up paintings of [[4]]
• went to New Mexico and was initially inspired to paint the many [[5]] that could be found there
• continued to paint various features that together formed the dramatic [[6]] of New Mexico for over forty years
• travelled widely by plane in later years, and painted pictures of clouds and [[7]] seen from above""",
        points=1.0,
        correct_answers=[
            {"answer": "teacher", "number": "1"},
            {"answer": "charcoal", "number": "2"},
            {"answer": "skyscrapers", "number": "3"},
            {"answer": "flowers", "number": "4"},
            {"answer": "bones", "number": "5"},
            {"answer": "landscape", "number": "6"},
            {"answer": "rivers", "number": "7"}
        ],
        extra_data={
            "answers": {
                "1": "teacher",
                "2": "charcoal", 
                "3": "skyscrapers",
                "4": "flowers",
                "5": "bones",
                "6": "landscape",
                "7": "rivers"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    # Question 2 - True/False/Not Given
    q2 = ReadingQuestion.objects.create(
        part=part1,
        order=2,
        question_type="true_false_not_given",
        header="Questions 8–13",
        instruction="Do the following statements agree with the information given in Reading Passage 1?\nIn boxes 8–13 on your answer sheet, write",
        image_url=None,
        question_text="""TRUE           	if the statement agrees with the information
FALSE          	if the statement contradicts the information
NOT GIVEN 	if there is no information on this""",
        points=1.0,
        correct_answers=["False", "True", "False", "True", "Not Given", "Not Given"],
        extra_data={
            "answers": ["False", "True", "False", "True", "Not Given", "Not Given"],
            "statements": [
                "Georgia O'Keeffe's style was greatly influenced by the changing fashions in art over the seven decades of her career.",
                "When O'Keeffe finished high school, she had already made her mind up about the career that she wanted.",
                "Alfred Stieglitz first discovered O'Keeffe's work when she sent some abstract drawings to his gallery in New York City.",
                "O'Keeffe was the subject of Stieglitz's photographic work for many years.",
                "O'Keeffe's paintings of the patio of her house in Abiquiú were among the artist's favourite works.",
                "O'Keeffe produced a greater quantity of work during the 1950s to 1970s than at any other time in her life."
            ]
        },
        reading_scoring_type="all_or_nothing"
    )
    
    print("✅ Part 1 создана с 2 вопросами")
    
    # PART 2 - Climate Change
    print("📝 Создаем Part 2...")
    part2 = ReadingPart.objects.create(
        test=test,
        part_number=2,
        title="Part 2",
        instructions="",
        passage_text="""<b>A</b>
All around the world, nations are already preparing for, and adapting to, climate change and its impacts. Even if we stopped all CO2 emissions tomorrow, we would continue to see the impact of the CO2 already released since industrial times, with scientists forecasting that global warming would continue for around 40 years. In the meantime, ice caps would continue to melt and sea levels rise. Some countries and regions will suffer more extreme impacts from these changes than others. It's in these places that innovation is thriving.

<b>B</b>
In Miami Beach, Florida, USA, seawater isn't just breaching the island city's walls, it's seeping up through the ground, so the only way to save the city is to lift it up above sea level. Starting in the lowest and most vulnerable neighbourhoods, roads have been raised by as much as 61 centimetres. The elevation work was carried out as part of Miami Beach's ambitious but much-needed stormwater-management programme. In addition to the road adaptations, the city has set up new pumps that can remove up to 75,000 litres of water per minute. In the face of floods, climate-mitigation strategies have often been overlooked, says Yanira Pineda, a senior sustainability coordinator. She knows that they're essential and that the job is far from over. 'We know that in 20, 30, 40 years, we'll need to go back in there and adjust to the changing environment,' she says.

<b>C</b>
Seawalls are a staple strategy for many coastal communities, but on the soft, muddy northern shores of Java, Indonesia, they frequently collapse, further exacerbating coastal erosion. There have been many attempts to restore the island's coastal mangroves: ecosystems of trees and shrubs that help defend coastal areas by trapping sediment in their net-like root systems, elevating the sea bed and dampening the energy of waves and tidal currents. But Susanna Tol of the not-for-profit organisation Wetlands International says that, while hugely popular, the majority of mangrove-planting projects fail. So, Wetlands International started out with a different approach, building semi-permeable dams, made from bamboo poles and brushwood, to mimic the role of mangrove roots and create favourable conditions for mangroves to grow back naturally. The programme has seen moderate success, mainly in areas with less subsidence. "Unfortunately, traditional infrastructure is often single-solution focused,' says Tol. 'For long-term success, it's critical that we transition towards multifunctional approaches that embed natural processes and that engage and benefit communities and local decision-makers."

<b>D</b>
As the floodwaters rose in the rice fields of the Mekong Delta in September 2018, four small houses rose with them. Homes in this part of Vietnam are traditionally built on stilts but these ones had been built to float. The modifications were made by the Buoyant Foundation Project, a not-for-profit organisation that has been researching and retrofitting amphibious houses since 2006. 'When I started this,' explains founder Elizabeth English, 'climate change was not on the tip of everybody's tongue, but this technology is becoming necessary in places that didn't previously need it.' It's much cheaper than permanently elevating houses, English explains – about a third of what it would cost to completely replace a building's foundations. It also avoids the problem of taller houses being at greater risk from wind damage. Another plus comes from the fact that amphibious structures can be sensitively adapted to meet cultural needs and match the kind of houses that are already common in a community.

<b>E</b>
Bangladesh is especially vulnerable to climate change. Most of the country is less than a metre above sea level and 80 per cent of its land lies on floodplains. 'Almost 35 million people living on the coastal belt of Bangladesh are currently affected by soil and water salinity,' says Raisa Chowdhury of the international development organisation ICCO Cooperation. Rather than fighting against it, one project is helping communities adapt to salt-affected soils. ICCO Cooperation has been working with 10,000 farmers in Bangladesh to start cultivating naturally salt-tolerant crops in the region. Certain varieties of carrot, potato, kohlrabi, cabbage and beetroot have been found to be better suited to salty soil than the rice and wheat that is typically grown there. Chowdhury says that the results are very visible, comparing a barren plot of land to the 'beautiful, lush green vegetable garden' sitting beside it, in which he and his team have been working with the farmers. Since the project began, farmers trained in saline agriculture have reported increases of two to three more harvests per year.

<b>F</b>
Greg Spotts from Los Angeles (LA) in the USA is chief sustainability officer of the city's street services department. He leads the Cool Streets LA programme, a series of pilot projects, which include the planting of trees and the installation of a 'cool pavement' system, designed to help reach the city's goal of bringing down its average temperature by 1.5°C. 'Urban cooling is literally a matter of life and death for our future in LA,' says Spotts. Using a Geographic Information System data mapping tool, the programme identified streets with low tree canopy cover in three of the city's neighbourhoods and covered them with a light-grey, light-reflecting coating, which had already been shown to lower road surface temperature in Los Angeles by 6°C. Spotts says one of these streets, in the Winnetka neighbourhood of San Fernando Valley, can now be seen as a pale crescent, the only cool spot on an otherwise red thermal image, from the International Space Station.""",
        passage_heading="Adapting to the effects of climate change",
        passage_image_url=None,
        order=1
    )
    
    # Question 3 - Which paragraph contains
    q3 = ReadingQuestion.objects.create(
        part=part2,
        order=1,
        question_type="gap_fill",
        header="Questions 14–17",
        instruction="Reading Passage 2 has six paragraphs, A–F.\nWhich paragraph contains the following information?\nWrite the correct letter, A–F, in boxes 14–17 on your answer sheet.",
        image_url=None,
        question_text="""[[14]]  how a type of plant functions as a natural protection for coastlines
[[15]]  a prediction about how long it could take to stop noticing the effects of climate change
[[16]]  a reference to the fact that a solution is particularly cost-effective
[[17]]  a mention of a technology used to locate areas most in need of intervention""",
        points=1.0,
        correct_answers=[
            {"answer": "C", "number": "14"},
            {"answer": "A", "number": "15"},
            {"answer": "D", "number": "16"},
            {"answer": "F", "number": "17"}
        ],
        extra_data={
            "answers": {
                "14": "C",
                "15": "A", 
                "16": "D",
                "17": "F"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    # Question 4 - Gap Fill
    q4 = ReadingQuestion.objects.create(
        part=part2,
        order=2,
        question_type="gap_fill",
        header="Questions 18–22",
        instruction="Complete the sentences below.\nChoose ONE WORD ONLY from the passage for each answer.\nWrite your answers in boxes 18–22 on your answer sheet.",
        image_url=None,
        question_text="""The stormwater-management programme in Miami Beach has involved the installation of efficient [[18]].
The construction of [[19]] was the first stage of a project to ensure the success of mangroves in Indonesia.
As a response to rising floodwaters in the Mekong Delta, a not-for-profit organisation has been building houses that can [[20]].
Rising sea levels in Bangladesh have made it necessary to introduce various [[21]] that are suitable for areas of high salt content.
A project in LA has increased the number of [[22]] on the city's streets.""",
        points=1.0,
        correct_answers=[
            {"answer": "pumps", "number": "18"},
            {"answer": "dams", "number": "19"},
            {"answer": "float", "number": "20"},
            {"answer": "crops", "number": "21"},
            {"answer": "trees", "number": "22"}
        ],
        extra_data={
            "answers": {
                "18": "pumps",
                "19": "dams",
                "20": "float",
                "21": "crops",
                "22": "trees"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    # Question 5 - Matching
    q5 = ReadingQuestion.objects.create(
        part=part2,
        order=3,
        question_type="gap_fill",
        header="Questions 23-26",
        instruction="Look at the following statements (Questions 23-26) and the list of people below.\nMatch each statement with the correct person, A-E.\nWrite the correct letter, A-E, in boxes 23–26 on your answer sheet.",
        image_url=None,
        question_text="""List of People
A  Yanira Pineda
B  Susanna Tol
C  Elizabeth English
D  Raisa Chowdhury
E  Greg Spotts

It is essential to adopt strategies which involve and help residents of the region [[23]]
Interventions which reduce heat are absolutely vital for our survival in this location [[24]]
More work will need to be done in future decades to deal with the impact of rising water levels [[25]]
The number of locations requiring action to adapt to flooding has grown in recent years [[26]]""",
        points=1.0,
        correct_answers=[
            {"answer": "B", "number": "23"},
            {"answer": "E", "number": "24"},
            {"answer": "A", "number": "25"},
            {"answer": "C", "number": "26"}
        ],
        extra_data={
            "answers": {
                "23": "B",
                "24": "E",
                "25": "A",
                "26": "C"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    print("✅ Part 2 создана с 3 вопросами")
    
    # PART 3 - Livestock Guard Dogs
    print("📝 Создаем Part 3...")
    part3 = ReadingPart.objects.create(
        test=test,
        part_number=3,
        title="Part 3",
        instructions="",
        passage_text="""<b>A</b>
For thousands of years, livestock guard dogs worked alongside shepherds to protect their sheep, goats and cattle from predators such as wolves and bears. But in the 19th and 20th centuries, when such predators were largely exterminated, most guard dogs lost their jobs. In recent years, however, as increased efforts have been made to protect wild animals, predators have become more widespread again. As a result, farmers once more need to protect their livestock, and guard dogs are enjoying an unexpected revival.

<b>B</b>
Today there are around 50 breeds of guard dogs on duty in various parts of the world. These dogs are raised from an early age with the animals they will be watching and eventually these animals become the dog's family. The dogs will place themselves between the livestock and any threat, barking loudly. If necessary, they will chase away predators, but often their mere presence is sufficient. 'Their initial training is to make them understand that livestock is going to be their life,' says Dan Macon, a shepherd with three guard dogs. 'A fluffy white puppy is fun to be around, but too much human affection makes it a great dog for guarding the front porch, rather than a great livestock guard dog.'

<b>C</b>
The evidence indicates that guard dogs are highly effective. For example, in Portugal, biologist Silvia Ribeiro has found that more than 90 per cent of the farmers participating in a programme to train and use guard dogs to protect their herds against attack from wolves rate the performance of the dogs as very good or excellent. In a study carried out in Australia by Linda van Bommel and Chris Johnson at the University of Tasmania, more than 65 per cent of herders reported that predation stopped completely after they got the dogs, and almost all the rest saw a decrease in attacks. 'If they are managed and used properly, livestock guard dogs are the most efficient control method that we have in terms of the amount of livestock that they save from predation,' says van Bommel.

<b>D</b>
But today's guard dogs also have a new role – to help preserve the predators. It is hoped that reductions in livestock losses can make farmers more tolerant of predators and less likely to kill them. In Namibia, more than 90 per cent of cheetahs live outside protected areas, close to humans raising livestock. As a result, the cheetahs are often held responsible for animal losses, and large numbers have been killed by farmers. When guard dogs were introduced, more than 90 per cent of farmers reported a dramatic reduction in livestock losses, and said that as a result they were less likely to kill predators. Julie Young, at Utah State University in the US, believes this result applies widely. "There is common ground from the livestock perspective and from the conservation perspective,' she says. 'If ranchers don't have a dead cow, they will not make a call to apply for a permit to kill a wolf."

<b>E</b>
Looking at all the published evidence, Bethany Smith at Nottingham Trent University in the UK found that up to 88 per cent of farmers said they no longer killed predators after using dogs – but warned that such self-reported results must be taken with a pinch of salt. What's more, it is possible that livestock guard dogs merely displace predators to unprotected neighbouring properties, where their fate isn't recorded. 'In some regions, we work with almost every farmer, but in others only one or two have dogs,' says Ribeiro. 'If we are not working with everybody, we are transferring the wolf pressure to the neighbour's herd and he can use poison and kill an entire pack of wolves.'

<b>F</b>
Another concern is whether there may be unintended ecological effects of using guard dogs. Studies suggest that reducing deaths of one type of predator may have a negative impact on other species. The extent of this problem isn't known, but the consequences are clear in Namibia. Cheetahs aren't the only species that cause sheep and goat losses there: other predators also attack livestock. In 2015, researchers reported that in spite of the impact farmers obtaining guard dogs had on cheetahs, the number of jackals killed by dogs and people actually increased. Guard dogs have other ecological impacts too. They have been found to spread diseases to wild animals, including endangered Ethiopian wolves. They may also compete with other carnivores for food. And by creating a 'landscape of fear', their mere presence can influence the behaviour of prey animals.

<b>G</b>
The evidence so far, however, indicates that these consequences aren't always negative. Guard dogs can deliver unexpected benefits by protecting vulnerable wildlife from predators. For example, their presence has been found to protect birds which build their nests on the ground in fields, where foxes would normally raid them. Indeed, Australian researchers are now using dogs to enhance biodiversity and create refuges for species threatened by predation. So if we can get this right, there may be a bright future for guard dogs in promoting harmonious coexistence between humans and wildlife.""",
        passage_heading="A new role for livestock guard dogs",
        passage_image_url=None,
        order=1
    )
    
    # Question 6 - Which paragraph contains
    q6 = ReadingQuestion.objects.create(
        part=part3,
        order=1,
        question_type="gap_fill",
        header="Questions 27–31",
        instruction="Reading Passage 3 has seven paragraphs, A–G.\nWhich paragraph contains the following information?\nWrite the correct letter, A–G, in boxes 27–31 on your answer sheet.\nNB   You may use any letter more than once.",
        image_url=None,
        question_text="""[[27]]  an example of how one predator has been protected by the introduction of livestock guard dogs
[[28]]  an optimistic suggestion about the possible positive developments in the use of livestock guard dogs
[[29]]  a description of how the methods used by livestock guard dogs help to keep predators away
[[30]]  claims by different academics that the use of livestock guard dogs is a successful way of protecting farmers' herds
[[31]]  a reference to how livestock guard dogs gain their skills""",
        points=1.0,
        correct_answers=[
            {"answer": "D", "number": "27"},
            {"answer": "G", "number": "28"},
            {"answer": "B", "number": "29"},
            {"answer": "C", "number": "30"},
            {"answer": "B", "number": "31"}
        ],
        extra_data={
            "answers": {
                "27": "D",
                "28": "G",
                "29": "B",
                "30": "C",
                "31": "B"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    # Question 7 - Matching people
    q7 = ReadingQuestion.objects.create(
        part=part3,
        order=2,
        question_type="gap_fill",
        header="Questions 32-36",
        instruction="Look at the following statements (Questions 32-36) and the list of people below.\nMatch each statement with the correct person, A-E.\nWrite the correct letter, A-E, in boxes 32–36 on your answer sheet.",
        image_url=None,
        question_text="""List of People
A  Dan Macon
B  Silvia Ribeiro
C  Linda van Bommel
D  Julie Young
E  Bethany Smith

[[32]]  The use of guard dogs may save the lives of both livestock and wild animals.
[[33]]  Claims of a change in behaviour from those using livestock guard dogs may not be totally accurate.
[[34]]  There may be negative results if the use of livestock guard dogs is not sufficiently widespread.
[[35]]  Livestock guard dogs are the best way of protecting farm animals, as long as the dogs are appropriately handled.
[[36]]  Teaching a livestock guard dog how to do its work needs a different focus from teaching a house guard dog.""",
        points=1.0,
        correct_answers=[
            {"answer": "D", "number": "32"},
            {"answer": "E", "number": "33"},
            {"answer": "B", "number": "34"},
            {"answer": "C", "number": "35"},
            {"answer": "A", "number": "36"}
        ],
        extra_data={
            "answers": {
                "32": "D",
                "33": "E",
                "34": "B",
                "35": "C",
                "36": "A"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    # Question 8 - Summary completion
    q8 = ReadingQuestion.objects.create(
        part=part3,
        order=3,
        question_type="gap_fill",
        header="Questions 37–40",
        instruction="Complete the summary below.\nChoose ONE WORD ONLY from the passage for each answer.\nWrite your answers in boxes 37–40 on your answer sheet.",
        image_url=None,
        question_text="""Unintended ecological effects of using guard dogs

In Namibia, livestock guard dogs have been used to protect domestic animals from attacks by cheetahs. This has led to a rise in the deaths of other predators, particularly [[37]].
In addition, it has been suggested that the dogs could have [[38]] which may affect other species, and that they may reduce the amount of [[39]] available to certain wild animals.
On the other hand, these dogs may help birds by protecting their nests. These might otherwise be threatened by predators such as [[40]].""",
        points=1.0,
        correct_answers=[
            {"answer": "jackals", "number": "37"},
            {"answer": "diseases", "number": "38"},
            {"answer": "food", "number": "39"},
            {"answer": "foxes", "number": "40"}
        ],
        extra_data={
            "answers": {
                "37": "jackals",
                "38": "diseases",
                "39": "food",
                "40": "foxes"
            }
        },
        reading_scoring_type="all_or_nothing"
    )
    
    print("✅ Part 3 создана с 3 вопросами")
    
    print(f"\n🎉 ТЕСТ ВОССТАНОВЛЕН!")
    print(f"📊 Статистика:")
    print(f"   • Частей: {test.parts.count()}")
    total_questions = sum(part.questions.count() for part in test.parts.all())
    print(f"   • Вопросов: {total_questions}")
    print(f"   • Обновлен explanation_url: {test.explanation_url}")

if __name__ == "__main__":
    restore_reading_test()


